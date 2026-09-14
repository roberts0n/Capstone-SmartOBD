import type { PerfilTaller } from '../tipos/usuarioTaller';
import { supabase } from './clienteSupabase';

export type RolPersonalInvitable = Exclude<PerfilTaller, 'administrador'>;

export interface InvitacionPersonal {
  nombre: string;
  correo: string;
  rol: RolPersonalInvitable;
  especialidad?: string;
}

interface RespuestaInvitacion {
  mensaje?: string;
}

/**
 * Solicita al backend que invite a una persona al taller.
 * La aplicacion nunca crea usuarios con una clave secreta: esa operacion queda
 * dentro de la Edge Function protegida.
 */
export async function invitarPersonalTaller(
  invitacion: InvitacionPersonal,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke<RespuestaInvitacion>(
    'crear-usuario-taller',
    { body: invitacion },
  );

  if (error) {
    throw new Error(await obtenerMensajeFuncion(error));
  }

  return data?.mensaje ?? 'Invitacion enviada correctamente.';
}

async function obtenerMensajeFuncion(error: unknown): Promise<string> {
  const contexto = (error as { context?: unknown })?.context;

  if (contexto instanceof Response) {
    try {
      const cuerpo = (await contexto.clone().json()) as { error?: string };
      if (cuerpo.error) {
        return cuerpo.error;
      }
    } catch {
      // La respuesta no siempre contiene JSON. En ese caso usamos un mensaje
      // estable para no mostrar detalles internos del servidor.
    }
  }

  return 'No se pudo enviar la invitacion. Intenta nuevamente.';
}
