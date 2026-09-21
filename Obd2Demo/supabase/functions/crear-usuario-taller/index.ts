import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

type RolRegistrable = 'recepcion' | 'mecanico';

interface SolicitudRegistro {
  nombre?: unknown;
  correo?: unknown;
  rol?: unknown;
  especialidad?: unknown;
  contrasenaTemporal?: unknown;
}

const CABECERAS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async solicitud => {
  if (solicitud.method === 'OPTIONS') {
    return new Response('ok', { headers: CABECERAS_CORS });
  }
  if (solicitud.method !== 'POST') {
    return responderError('Metodo no permitido.', 405);
  }

  try {
    const autorizacion = solicitud.headers.get('Authorization');
    if (!autorizacion?.startsWith('Bearer ')) {
      return responderError('Debes iniciar sesion.', 401);
    }

    const urlSupabase = exigirVariable('SUPABASE_URL');
    const clavePublicable = obtenerClave(
      'SUPABASE_PUBLISHABLE_KEYS',
      'SUPABASE_ANON_KEY',
    );
    const claveSecreta = obtenerClave(
      'SUPABASE_SECRET_KEYS',
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    // Este cliente representa a la persona que llamo la funcion. Sus consultas
    // respetan RLS y ademas verificamos su token contra Supabase Auth.
    const clienteUsuario = createClient(urlSupabase, clavePublicable, {
      global: { headers: { Authorization: autorizacion } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: usuario },
      error: errorUsuario,
    } = await clienteUsuario.auth.getUser();

    if (errorUsuario || !usuario) {
      return responderError('La sesion no es valida.', 401);
    }

    const { data: perfil, error: errorPerfil } = await clienteUsuario
      .from('perfiles')
      .select('taller_id, rol, activo, debe_cambiar_password')
      .eq('id', usuario.id)
      .single();

    if (errorPerfil || !perfil) {
      return responderError('No tienes permisos para registrar personal.', 403);
    }
    if (!perfil.activo) {
      return responderError('Tu cuenta se encuentra desactivada.', 403);
    }
    if (perfil.debe_cambiar_password) {
      return responderError('Primero debes cambiar tu contrasena temporal.', 403);
    }
    if (perfil.rol !== 'administrador' || !perfil.taller_id) {
      return responderError('No tienes permisos para registrar personal.', 403);
    }

    const entrada = (await solicitud.json()) as SolicitudRegistro;
    let datos: ReturnType<typeof validarEntrada>;
    try {
      datos = validarEntrada(entrada);
    } catch {
      return responderError('Revisa los datos ingresados.', 400);
    }

    // La clave secreta existe solamente dentro de Supabase. Este cliente puede
    // crear usuarios, por eso nunca se exporta ni se copia a la aplicacion.
    const clienteAdministrador = createClient(urlSupabase, claveSecreta, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Confirmar administrativamente el correo permite acceder de inmediato con
    // la contrasena temporal, sin enviar enlaces ni modificar Auth global.
    const { data: creado, error: errorCrear } =
      await clienteAdministrador.auth.admin.createUser({
        email: datos.correo,
        password: datos.contrasenaTemporal,
        email_confirm: true,
        user_metadata: { nombre: datos.nombre },
      });

    if (errorCrear || !creado.user) {
      return responderError(
        traducirErrorCreacion(errorCrear?.message),
        400,
      );
    }

    const { error: errorInsertarPerfil } = await clienteAdministrador
      .from('perfiles')
      .insert({
        id: creado.user.id,
        taller_id: perfil.taller_id,
        nombre: datos.nombre,
        rol: datos.rol,
        especialidad: datos.especialidad,
        activo: true,
        debe_cambiar_password: true,
      });

    if (errorInsertarPerfil) {
      // Auth y Postgres son servicios distintos. Si falla el perfil, eliminamos
      // el usuario recien creado para no dejar una cuenta incompleta.
      const { error: errorEliminar } =
        await clienteAdministrador.auth.admin.deleteUser(creado.user.id);
      if (errorEliminar) {
        console.error('No se pudo revertir el usuario Auth:', errorEliminar);
      }
      return responderError('No se pudo guardar el perfil del taller.', 500);
    }

    return responderJson(
      {
        mensaje: 'Cuenta creada. Entrega las credenciales al trabajador de forma segura.',
        usuarioId: creado.user.id,
      },
      201,
    );
  } catch {
    return responderError('No fue posible crear la cuenta. Intentalo nuevamente.', 500);
  }
});

function validarEntrada(entrada: SolicitudRegistro): {
  nombre: string;
  correo: string;
  rol: RolRegistrable;
  especialidad: string | null;
  contrasenaTemporal: string;
} {
  const nombre =
    typeof entrada.nombre === 'string' ? entrada.nombre.trim() : '';
  const correo =
    typeof entrada.correo === 'string'
      ? entrada.correo.trim().toLowerCase()
      : '';
  const especialidad =
    typeof entrada.especialidad === 'string' ? entrada.especialidad.trim() : '';
  const contrasenaTemporal =
    typeof entrada.contrasenaTemporal === 'string'
      ? entrada.contrasenaTemporal
      : '';

  if (nombre.length < 2 || nombre.length > 120) {
    throw new Error('Nombre invalido');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 254) {
    throw new Error('Correo invalido');
  }
  if (!esRolRegistrable(entrada.rol)) {
    throw new Error('Rol invalido');
  }
  if (especialidad.length > 120) {
    throw new Error('Especialidad invalida');
  }
  if (contrasenaTemporal.length < 8) {
    throw new Error('Contrasena invalida');
  }

  return {
    nombre,
    correo,
    rol: entrada.rol,
    especialidad: entrada.rol === 'mecanico' ? especialidad || null : null,
    contrasenaTemporal,
  };
}

function esRolRegistrable(valor: unknown): valor is RolRegistrable {
  return valor === 'recepcion' || valor === 'mecanico';
}

function obtenerClave(variableNueva: string, variableAnterior: string): string {
  const diccionario = Deno.env.get(variableNueva);
  if (diccionario) {
    const claves = JSON.parse(diccionario) as Record<string, string>;
    const primera = claves.default ?? Object.values(claves)[0];
    if (primera) {
      return primera;
    }
  }
  return exigirVariable(variableAnterior);
}

function exigirVariable(nombre: string): string {
  const valor = Deno.env.get(nombre);
  if (!valor) {
    throw new Error(`Falta la variable ${nombre}`);
  }
  return valor;
}

function traducirErrorCreacion(mensaje?: string): string {
  const texto = mensaje?.toLowerCase() ?? '';
  if (texto.includes('already') || texto.includes('registered')) {
    return 'Ya existe una cuenta registrada con este correo.';
  }
  if (texto.includes('rate') || texto.includes('limit')) {
    return 'No fue posible crear la cuenta. Intentalo mas tarde.';
  }
  return 'No fue posible crear la cuenta. Intentalo nuevamente.';
}

function responderError(error: string, estado: number): Response {
  return responderJson({ error }, estado);
}

function responderJson(contenido: unknown, estado: number): Response {
  return new Response(JSON.stringify(contenido), {
    status: estado,
    headers: { ...CABECERAS_CORS, 'Content-Type': 'application/json' },
  });
}
