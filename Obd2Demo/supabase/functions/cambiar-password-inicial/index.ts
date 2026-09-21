import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async solicitud => {
  if (solicitud.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (solicitud.method !== 'POST') return responder('Metodo no permitido.', 405);

  try {
    const autorizacion = solicitud.headers.get('Authorization');
    if (!autorizacion?.startsWith('Bearer ')) return responder('Debes iniciar sesion.', 401);

    const url = exigirVariable('SUPABASE_URL');
    const clavePublica = obtenerClave('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    const usuarioCliente = createClient(url, clavePublica, {
      global: { headers: { Authorization: autorizacion } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: errorUsuario } = await usuarioCliente.auth.getUser();
    if (errorUsuario || !user) return responder('La sesion no es valida.', 401);

    const { data: perfil, error: errorPerfil } = await usuarioCliente
      .from('perfiles')
      .select('id, activo, debe_cambiar_password')
      .eq('id', user.id)
      .single();
    if (errorPerfil || !perfil) return responder('No se encontro tu perfil.', 403);
    if (!perfil.activo) return responder('Tu cuenta se encuentra desactivada.', 403);
    if (!perfil.debe_cambiar_password) return responder('La contrasena inicial ya fue cambiada.', 409);

    const cuerpo = (await solicitud.json()) as { nuevaContrasena?: unknown };
    const nuevaContrasena = typeof cuerpo.nuevaContrasena === 'string'
      ? cuerpo.nuevaContrasena : '';
    if (nuevaContrasena.length < 8) return responder('La nueva contrasena debe tener al menos 8 caracteres.', 400);

    // /auth/v1/user modifica exclusivamente el usuario identificado por SU JWT.
    // La clave administrativa no interviene en el cambio de contrasena.
    const cambioAuth = await fetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        Authorization: autorizacion,
        apikey: clavePublica,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: nuevaContrasena }),
    });
    if (!cambioAuth.ok) return responder('No fue posible cambiar la contrasena.', 400);

    // El UPDATE de perfiles esta revocado para authenticated. Solo despues de
    // confirmar Auth levantamos el bloqueo de primer inicio, para este UID.
    const claveSecreta = obtenerClave('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    const administrador = createClient(url, claveSecreta, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: actualizado, error: errorActualizar } = await administrador
      .from('perfiles')
      .update({ debe_cambiar_password: false })
      .eq('id', user.id)
      .eq('activo', true)
      .eq('debe_cambiar_password', true)
      .select('id')
      .single();
    if (errorActualizar || !actualizado) {
      return responder('La contrasena cambio, pero no se pudo activar el acceso. Intentalo nuevamente.', 500);
    }

    return new Response(JSON.stringify({ mensaje: 'Contrasena actualizada.' }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch {
    return responder('No fue posible completar el cambio. Intentalo nuevamente.', 500);
  }
});

function obtenerClave(nueva: string, anterior: string): string {
  const diccionario = Deno.env.get(nueva);
  if (diccionario) {
    const claves = JSON.parse(diccionario) as Record<string, string>;
    const valor = claves.default ?? Object.values(claves)[0];
    if (valor) return valor;
  }
  return exigirVariable(anterior);
}

function exigirVariable(nombre: string): string {
  const valor = Deno.env.get(nombre);
  if (!valor) throw new Error(`Falta ${nombre}`);
  return valor;
}

function responder(error: string, estado: number): Response {
  return new Response(JSON.stringify({ error }), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
