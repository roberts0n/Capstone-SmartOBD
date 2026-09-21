import type { PerfilTaller } from '../tipos/usuarioTaller';
import { supabase } from './clienteSupabase';

export type RolPersonalRegistrable = Exclude<PerfilTaller, 'administrador'>;

export interface NuevoPersonal {
  nombre: string;
  correo: string;
  rol: RolPersonalRegistrable;
  especialidad?: string;
  contrasenaTemporal: string;
}

interface RespuestaRegistro {
  mensaje?: string;
}

/**
 * Solicita al backend que cree una cuenta corporativa del taller.
 * La aplicacion nunca crea usuarios con una clave secreta: esa operacion queda
 * dentro de la Edge Function protegida.
 */
export async function registrarPersonalTaller(
  personal: NuevoPersonal,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke<RespuestaRegistro>(
    'crear-usuario-taller',
    { body: personal },
  );

  if (error) {
    throw new Error(await obtenerMensajeFuncion(error));
  }

  return data?.mensaje ?? 'Cuenta corporativa creada correctamente.';
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

  return 'No fue posible crear la cuenta. Intenta nuevamente.';
}
