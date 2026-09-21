import type { User } from '@supabase/supabase-js';
import type { PerfilTaller, SesionTaller } from '../tipos/usuarioTaller';
import { supabase } from './clienteSupabase';

interface PerfilConsultado {
  id: string;
  taller_id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  debe_cambiar_password: boolean;
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

  try {
    return await cargarPerfil(data.session.user);
  } catch (errorPerfil) {
    await supabase.auth.signOut().catch(() => undefined);
    throw errorPerfil;
  }
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
    .select('id, taller_id, nombre, rol, activo, debe_cambiar_password')
    .eq('id', usuario.id)
    .single();

  if (error || !data) {
    throw new Error(
      'Tu cuenta existe, pero no tiene un perfil de taller habilitado.',
    );
  }

  const perfil = data as unknown as PerfilConsultado;
  if (!perfil.activo) {
    throw new Error(
      'Tu cuenta se encuentra desactivada. Contacta al administrador.',
    );
  }
  if (!esPerfilTaller(perfil.rol)) {
    throw new Error('Tu cuenta tiene un rol que SmartOBD no reconoce.');
  }

  let nombreTaller = '';
  if (!perfil.debe_cambiar_password) {
    const { data: taller, error: errorTaller } = await supabase
      .from('talleres')
      .select('nombre')
      .eq('id', perfil.taller_id)
      .single();
    if (errorTaller || !taller?.nombre) {
      throw new Error('No se encontro el taller asociado a tu cuenta.');
    }
    nombreTaller = taller.nombre;
  }

  return {
    usuarioId: perfil.id,
    nombre: perfil.nombre,
    correo: usuario.email ?? '',
    tallerId: perfil.taller_id,
    taller: nombreTaller,
    perfil: perfil.rol,
    debeCambiarPassword: perfil.debe_cambiar_password,
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
