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

export interface IntegranteTaller {
  id: string;
  nombre: string;
  rol: PerfilTaller;
  especialidad: string | null;
}

export interface ResumenAdministrador {
  equipo: IntegranteTaller[];
  diagnosticos: number;
  porRevisar: number;
  enTrabajo: number;
}

interface FilaIntegranteTaller {
  id: string;
  nombre: string;
  rol: PerfilTaller;
  especialidad: string | null;
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

/**
 * Recupera solo los totales que puede ver el administrador según las
 * políticas RLS del taller. No recibe taller_id ni descarga filas completas.
 */
export async function obtenerResumenAdministrador(): Promise<ResumenAdministrador> {
  const [personal, diagnosticos, porRevisar, enTrabajo] = await Promise.all([
    supabase
      .from('perfiles')
      .select('id, nombre, rol, especialidad')
      .eq('activo', true),
    supabase
      .from('casos_diagnosticos')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['diagnosticado', 'cerrado']),
    supabase
      .from('casos_diagnosticos')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['ingresado', 'diagnostico_inicial']),
    supabase
      .from('casos_diagnosticos')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['asignado', 'en_revision']),
  ]);

  if (
    personal.error ||
    diagnosticos.error ||
    porRevisar.error ||
    enTrabajo.error
  ) {
    throw new Error('No fue posible cargar el resumen del taller.');
  }

  const equipo = ((personal.data ?? []) as FilaIntegranteTaller[]).sort(
    (primero, segundo) =>
      ordenRol(primero.rol) - ordenRol(segundo.rol) ||
      primero.nombre.localeCompare(segundo.nombre, 'es'),
  );

  return {
    equipo,
    diagnosticos: diagnosticos.count ?? 0,
    porRevisar: porRevisar.count ?? 0,
    enTrabajo: enTrabajo.count ?? 0,
  };
}

function ordenRol(rol: PerfilTaller): number {
  if (rol === 'mecanico') return 0;
  if (rol === 'recepcion') return 1;
  return 2;
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
