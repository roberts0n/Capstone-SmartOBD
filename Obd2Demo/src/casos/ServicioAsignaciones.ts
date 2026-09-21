import { supabase } from '../servicios/clienteSupabase';
import type { SesionTaller } from '../tipos/usuarioTaller';
import { obtenerCasoDiagnostico } from './ServicioCasosDiagnostico';
import type {
  MecanicoAsignable,
  NuevaAsignacionCaso,
  ResultadoAsignacionCaso,
} from './TiposAsignacion';

interface FilaMecanico {
  id: string;
  nombre: string;
  especialidad: string | null;
}

export async function listarMecanicosActivos(): Promise<MecanicoAsignable[]> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, especialidad')
    .eq('rol', 'mecanico')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error('No se pudo obtener la lista de mecanicos.');
  }

  return ((data ?? []) as FilaMecanico[]).map(fila => ({
    id: fila.id,
    nombre: fila.nombre,
    especialidad: fila.especialidad,
  }));
}

export async function asignarMecanicoCaso(
  entrada: NuevaAsignacionCaso,
  sesion: SesionTaller,
): Promise<ResultadoAsignacionCaso> {
  validarAsignacion(entrada, sesion);

  const casoId = entrada.casoId.trim();
  const mecanicoId = entrada.mecanicoId.trim();
  const nota = entrada.nota?.trim() || null;
  const { data, error } = await supabase.rpc('asignar_mecanico_caso', {
    caso_objetivo: casoId,
    mecanico_objetivo: mecanicoId,
    prioridad_nueva: entrada.prioridad ?? 'normal',
    nota_nueva: nota,
  });

  if (error || typeof data !== 'string') {
    throw new Error(mensajeErrorAsignacion(error));
  }

  const caso = await obtenerCasoDiagnostico(casoId);
  if (!caso) {
    throw new Error('La asignacion se completo, pero no se pudo recargar el caso.');
  }

  return {
    asignacionId: data,
    caso,
  };
}

function validarAsignacion(
  entrada: NuevaAsignacionCaso,
  sesion: SesionTaller,
): void {
  if (sesion.perfil !== 'recepcion') {
    throw new Error('Solo recepcion puede asignar un mecanico.');
  }
  if (!sesion.tallerId.trim() || !sesion.usuarioId.trim()) {
    throw new Error('La sesion no contiene los datos necesarios del taller.');
  }
  if (!entrada.casoId.trim()) {
    throw new Error('Se necesita el identificador del caso.');
  }
  if (!entrada.mecanicoId.trim()) {
    throw new Error('Selecciona un mecanico antes de asignar el caso.');
  }
  if ((entrada.nota?.trim().length ?? 0) > 1000) {
    throw new Error('La nota de asignacion supera el limite permitido.');
  }
}

function mensajeErrorAsignacion(error: unknown): string {
  const detalle = (error as { message?: string } | null)?.message?.toLowerCase();

  if (detalle?.includes('asignacion activa')) {
    return 'El caso ya tiene una asignacion activa.';
  }
  if (detalle?.includes('mecanico no existe')) {
    return 'El mecanico no esta disponible para esta asignacion.';
  }
  if (detalle?.includes('ya fue entregado')) {
    return 'El caso ya fue entregado o no pertenece a esta recepcion.';
  }

  return 'No se pudo asignar el mecanico. Intenta nuevamente.';
}
