import type { SesionTaller } from '../tipos/usuarioTaller';
import { supabase } from '../servicios/clienteSupabase';
import type {
  CasoDiagnostico,
  EstadoCasoDiagnostico,
  NuevoCasoDiagnostico,
  PrioridadCasoDiagnostico,
} from './TiposCasoDiagnostico';

interface FilaCasoDiagnostico {
  id: string;
  taller_id: string;
  vehiculo_id: string;
  motivo_ingreso: string;
  sintomas_informados: string | null;
  estado: EstadoCasoDiagnostico;
  prioridad: PrioridadCasoDiagnostico;
  recepcion_id: string;
  mecanico_asignado_id: string | null;
  conclusion_tecnica: string | null;
  creado_en: string;
  actualizado_en: string;
  cerrado_en: string | null;
}

const CAMPOS_CASO =
  'id, taller_id, vehiculo_id, motivo_ingreso, sintomas_informados, estado, prioridad, recepcion_id, mecanico_asignado_id, conclusion_tecnica, creado_en, actualizado_en, cerrado_en';

export async function crearCasoDiagnostico(
  entrada: NuevoCasoDiagnostico,
  sesion: SesionTaller,
): Promise<CasoDiagnostico> {
  validarCreacion(entrada, sesion);

  const sintomas = entrada.sintomasInformados?.trim() || null;
  const { data, error } = await supabase
    .from('casos_diagnosticos')
    .insert({
      taller_id: sesion.tallerId,
      vehiculo_id: entrada.vehiculoId.trim(),
      motivo_ingreso: entrada.motivoIngreso.trim(),
      sintomas_informados: sintomas,
      prioridad: entrada.prioridad ?? 'normal',
      recepcion_id: sesion.usuarioId,
    })
    .select(CAMPOS_CASO)
    .single();

  if (error || !data) {
    throw new Error(mensajeErrorCreacion(error));
  }

  return convertirCaso(data as FilaCasoDiagnostico);
}

export async function obtenerCasoDiagnostico(
  casoId: string,
): Promise<CasoDiagnostico | null> {
  if (!casoId.trim()) {
    throw new Error('Se necesita el identificador del caso.');
  }

  const { data, error } = await supabase
    .from('casos_diagnosticos')
    .select(CAMPOS_CASO)
    .eq('id', casoId.trim())
    .maybeSingle();

  if (error) {
    throw new Error('No se pudo recuperar el caso de diagnostico.');
  }

  return data ? convertirCaso(data as FilaCasoDiagnostico) : null;
}

function validarCreacion(
  entrada: NuevoCasoDiagnostico,
  sesion: SesionTaller,
): void {
  if (sesion.perfil !== 'recepcion') {
    throw new Error('Solo recepcion puede crear un caso de diagnostico.');
  }
  if (!sesion.tallerId.trim() || !sesion.usuarioId.trim()) {
    throw new Error('La sesion no contiene los datos necesarios del taller.');
  }
  if (!entrada.vehiculoId.trim()) {
    throw new Error('Selecciona un vehiculo antes de crear el caso.');
  }
  if (entrada.motivoIngreso.trim().length < 3) {
    throw new Error('El motivo de ingreso debe tener al menos 3 caracteres.');
  }
}

function convertirCaso(fila: FilaCasoDiagnostico): CasoDiagnostico {
  return {
    id: fila.id,
    tallerId: fila.taller_id,
    vehiculoId: fila.vehiculo_id,
    motivoIngreso: fila.motivo_ingreso,
    sintomasInformados: fila.sintomas_informados,
    estado: fila.estado,
    prioridad: fila.prioridad,
    recepcionId: fila.recepcion_id,
    mecanicoAsignadoId: fila.mecanico_asignado_id,
    conclusionTecnica: fila.conclusion_tecnica,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    cerradoEn: fila.cerrado_en,
  };
}

function mensajeErrorCreacion(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code;

  if (codigo === '23503') {
    return 'El vehiculo seleccionado no existe o no pertenece al taller.';
  }
  if (codigo === '42501') {
    return 'Tu cuenta no tiene permiso para crear casos en este taller.';
  }

  return 'No se pudo crear el caso de diagnostico. Intenta nuevamente.';
}
