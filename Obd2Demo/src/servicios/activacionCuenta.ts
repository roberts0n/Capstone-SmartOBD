import type { SesionTaller } from '../tipos/usuarioTaller';
import { recuperarSesionTaller } from './autenticacionTaller';
import { supabase } from './clienteSupabase';

export const URL_ACTIVACION_CUENTA = 'smartobd://activar-cuenta';

/**
 * Recibe el enlace del correo y entrega sus credenciales a Supabase Auth.
 * Retorna false cuando el enlace pertenece a otra función de la aplicación.
 */
export async function prepararActivacionDesdeEnlace(
  enlace: string,
): Promise<boolean> {
  const url = new URL(enlace);
  if (
    url.protocol !== 'smartobd:' ||
    url.hostname.toLowerCase() !== 'activar-cuenta'
  ) {
    return false;
  }

  const parametrosFragmento = new URLSearchParams(
    url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
  );
  const descripcionError =
    parametrosFragmento.get('error_description') ??
    url.searchParams.get('error_description');

  if (descripcionError) {
    throw new Error(
      'La invitacion vencio o ya fue utilizada. Solicita una nueva invitacion.',
    );
  }

  const codigo = url.searchParams.get('code');
  if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (error) {
      throw new Error('No se pudo validar la invitacion recibida.');
    }
    return true;
  }

  const accessToken = parametrosFragmento.get('access_token');
  const refreshToken = parametrosFragmento.get('refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('El enlace de invitacion no contiene una sesion valida.');
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    throw new Error('No se pudo validar la invitacion recibida.');
  }

  return true;
}

/** Valida manualmente el código de invitación recibido por correo. */
export async function validarCodigoInvitacion(
  correo: string,
  codigo: string,
): Promise<void> {
  const correoLimpio = correo.trim().toLowerCase();
  const codigoLimpio = codigo.replace(/\s/g, '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
    throw new Error('Ingresa el mismo correo que recibio la invitacion.');
  }
  if (!/^\d{6,10}$/.test(codigoLimpio)) {
    throw new Error('Ingresa el codigo numerico recibido por correo.');
  }

  const { error } = await supabase.auth.verifyOtp({
    email: correoLimpio,
    token: codigoLimpio,
    type: 'invite',
  });
  if (error) {
    throw new Error(
      'El codigo no es valido o vencio. Solicita una nueva invitacion.',
    );
  }
}

/** Guarda la contraseña elegida y carga el perfil asignado por Administración. */
export async function activarCuentaInvitada(
  contrasena: string,
): Promise<SesionTaller> {
  validarContrasena(contrasena);

  const { error } = await supabase.auth.updateUser({ password: contrasena });
  if (error) {
    throw new Error(traducirErrorContrasena(error.message));
  }

  const sesion = await recuperarSesionTaller();
  if (!sesion) {
    throw new Error(
      'La cuenta se activo, pero no fue posible cargar su perfil.',
    );
  }
  return sesion;
}

function validarContrasena(contrasena: string): void {
  if (contrasena.length < 8) {
    throw new Error('La contrasena debe tener al menos 8 caracteres.');
  }
  if (!/[A-Za-z]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
    throw new Error('Combina letras y numeros en tu contrasena.');
  }
}

function traducirErrorContrasena(mensaje: string): string {
  const normalizado = mensaje.toLowerCase();
  if (normalizado.includes('password') && normalizado.includes('weak')) {
    return 'La contrasena es demasiado debil. Usa una combinacion diferente.';
  }
  if (normalizado.includes('session') || normalizado.includes('jwt')) {
    return 'La invitacion vencio. Solicita una nueva invitacion.';
  }
  return 'No se pudo guardar la contrasena. Intenta nuevamente.';
}
