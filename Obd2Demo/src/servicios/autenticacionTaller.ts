import type { User } from '@supabase/supabase-js';
import type { PerfilTaller, SesionTaller } from '../tipos/usuarioTaller';
import { supabase } from './clienteSupabase';

interface PerfilConsultado {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  talleres: { nombre: string } | Array<{ nombre: string }> | null;
}

export async function iniciarSesionTaller(
  correo: string,
  contrasena: string,
): Promise<SesionTaller> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo.trim(),
    password: contrasena,
  });

  if (error) {
    throw new Error(traducirErrorAcceso(error.message));
  }

  try {
    return await cargarPerfil(data.user);
  } catch (errorPerfil) {
    await supabase.auth.signOut().catch(() => undefined);
    throw errorPerfil;
  }
}

export async function recuperarSesionTaller(): Promise<SesionTaller | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error('No se pudo recuperar la sesion guardada.');
  }
  if (!data.session) {
    return null;
  }

  return cargarPerfil(data.session.user);
}

export async function cerrarSesionTaller(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error('No se pudo cerrar la sesion. Intenta nuevamente.');
  }
}

async function cargarPerfil(usuario: User): Promise<SesionTaller> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, rol, activo, talleres!inner(nombre)')
    .eq('id', usuario.id)
    .single();

  if (error || !data) {
    throw new Error(
      'Tu cuenta existe, pero no tiene un perfil de taller habilitado.',
    );
  }

  const perfil = data as unknown as PerfilConsultado;
  if (!perfil.activo) {
    throw new Error('Tu acceso al taller se encuentra desactivado.');
  }
  if (!esPerfilTaller(perfil.rol)) {
    throw new Error('Tu cuenta tiene un rol que SmartOBD no reconoce.');
  }

  const relacionTaller = Array.isArray(perfil.talleres)
    ? perfil.talleres[0]
    : perfil.talleres;
  if (!relacionTaller?.nombre) {
    throw new Error('No se encontro el taller asociado a tu cuenta.');
  }

  return {
    usuarioId: perfil.id,
    nombre: perfil.nombre,
    correo: usuario.email ?? '',
    taller: relacionTaller.nombre,
    perfil: perfil.rol,
  };
}

function esPerfilTaller(valor: string): valor is PerfilTaller {
  return ['administrador', 'recepcion', 'mecanico'].includes(valor);
}

function traducirErrorAcceso(mensaje: string): string {
  const normalizado = mensaje.toLowerCase();
  if (normalizado.includes('invalid login credentials')) {
    return 'Correo o contrasena incorrectos.';
  }
  if (normalizado.includes('email not confirmed')) {
    return 'Confirma tu correo antes de ingresar.';
  }
  if (normalizado.includes('fetch')) {
    return 'No se pudo conectar con Supabase. Revisa tu conexion a internet.';
  }
  return 'No fue posible iniciar sesion. Intenta nuevamente.';
}
