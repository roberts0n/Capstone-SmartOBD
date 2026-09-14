import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

type RolInvitable = 'recepcion' | 'mecanico';

interface SolicitudInvitacion {
  nombre?: unknown;
  correo?: unknown;
  rol?: unknown;
  especialidad?: unknown;
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
      .select('taller_id, rol, activo')
      .eq('id', usuario.id)
      .single();

    if (
      errorPerfil ||
      !perfil ||
      !perfil.activo ||
      perfil.rol !== 'administrador'
    ) {
      return responderError('Solo Administracion puede invitar personal.', 403);
    }

    const entrada = (await solicitud.json()) as SolicitudInvitacion;
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

    // El plan gratuito no permite personalizar el correo predeterminado. En
    // vez de depender de un enlace que algunos correos consumen al revisarlo,
    // generamos un OTP para que Administracion lo entregue al trabajador.
    const { data: invitacion, error: errorInvitacion } =
      await clienteAdministrador.auth.admin.generateLink({
        type: 'invite',
        email: datos.correo,
        options: {
          data: { nombre: datos.nombre },
          redirectTo:
            Deno.env.get('URL_REDIRECCION_INVITACION') ??
            'smartobd://activar-cuenta',
        },
      });

    if (
      errorInvitacion ||
      !invitacion.user ||
      !invitacion.properties?.email_otp
    ) {
      console.error('No se pudo crear la invitacion:', errorInvitacion);
      return responderError(
        traducirErrorInvitacion(errorInvitacion?.message),
        400,
      );
    }

    const { error: errorInsertarPerfil } = await clienteAdministrador
      .from('perfiles')
      .insert({
        id: invitacion.user.id,
        taller_id: perfil.taller_id,
        nombre: datos.nombre,
        rol: datos.rol,
        especialidad: datos.especialidad,
      });

    if (errorInsertarPerfil) {
      console.error('No se pudo crear el perfil:', errorInsertarPerfil);

      // Auth y Postgres son servicios distintos. Si falla el perfil, eliminamos
      // el usuario recien creado para no dejar una cuenta incompleta.
      await clienteAdministrador.auth.admin.deleteUser(invitacion.user.id);
      return responderError('No se pudo guardar el perfil del taller.', 500);
    }

    return responderJson(
      {
        mensaje:
          `Codigo temporal: ${invitacion.properties.email_otp}. ` +
          `Entregalo solamente a ${datos.correo}.`,
        usuarioId: invitacion.user.id,
      },
      201,
    );
  } catch (error) {
    console.error('Error inesperado al invitar personal:', error);
    return responderError('No se pudo procesar la invitacion.', 500);
  }
});

function validarEntrada(entrada: SolicitudInvitacion): {
  nombre: string;
  correo: string;
  rol: RolInvitable;
  especialidad: string | null;
} {
  const nombre =
    typeof entrada.nombre === 'string' ? entrada.nombre.trim() : '';
  const correo =
    typeof entrada.correo === 'string'
      ? entrada.correo.trim().toLowerCase()
      : '';
  const especialidad =
    typeof entrada.especialidad === 'string' ? entrada.especialidad.trim() : '';

  if (nombre.length < 2 || nombre.length > 120) {
    throw new Error('Nombre invalido');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 254) {
    throw new Error('Correo invalido');
  }
  if (!esRolInvitable(entrada.rol)) {
    throw new Error('Rol invalido');
  }
  if (especialidad.length > 120) {
    throw new Error('Especialidad invalida');
  }

  return {
    nombre,
    correo,
    rol: entrada.rol,
    especialidad: especialidad || null,
  };
}

function esRolInvitable(valor: unknown): valor is RolInvitable {
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

function traducirErrorInvitacion(mensaje?: string): string {
  const texto = mensaje?.toLowerCase() ?? '';
  if (texto.includes('already') || texto.includes('registered')) {
    return 'Ya existe una cuenta con ese correo.';
  }
  if (texto.includes('rate') || texto.includes('limit')) {
    return 'Se enviaron demasiadas invitaciones. Intenta mas tarde.';
  }
  return 'No se pudo enviar la invitacion al correo indicado.';
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
