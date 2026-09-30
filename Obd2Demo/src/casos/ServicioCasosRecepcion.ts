import { supabase } from '../servicios/clienteSupabase';
import type { EstadoCasoDiagnostico } from './TiposCasoDiagnostico';

export interface CasoAsignadoRecepcion {
  id: string;
  cliente: string;
  vehiculo: string;
  patente: string;
  mecanico: string;
  creadoEn: string;
  estado: 'no_revisado' | 'revisado';
}

interface FilaCaso {
  id: string;
  vehiculo_id: string;
  estado: EstadoCasoDiagnostico;
  creado_en: string;
}

interface FilaAsignacion {
  caso_id: string;
  mecanico_id: string;
}

interface FilaVehiculo {
  id: string;
  cliente_id: string;
  patente: string | null;
  marca: string | null;
  modelo: string | null;
}

interface FilaCliente {
  id: string;
  nombre: string;
}

interface FilaPerfil {
  id: string;
  nombre: string;
}

export async function listarCasosAsignadosRecepcion(): Promise<CasoAsignadoRecepcion[]> {
  const { data: asignaciones, error: errorAsignaciones } = await supabase
    .from('asignaciones')
    .select('caso_id, mecanico_id')
    .eq('estado', 'activa');

  if (errorAsignaciones) {
    throw new Error('No se pudieron consultar los casos asignados.');
  }

  const filasAsignacion = (asignaciones ?? []) as FilaAsignacion[];
  if (filasAsignacion.length === 0) return [];

  const { data: casos, error: errorCasos } = await supabase
    .from('casos_diagnosticos')
    .select('id, vehiculo_id, estado, creado_en')
    .in('id', filasAsignacion.map(item => item.caso_id))
    .order('creado_en', { ascending: false });

  if (errorCasos) {
    throw new Error('No se pudieron cargar los datos de los casos.');
  }

  const filasCaso = (casos ?? []) as FilaCaso[];
  if (filasCaso.length === 0) return [];

  const { data: vehiculos, error: errorVehiculos } = await supabase
    .from('vehiculos')
    .select('id, cliente_id, patente, marca, modelo')
    .in('id', unicos(filasCaso.map(item => item.vehiculo_id)));

  if (errorVehiculos) {
    throw new Error('No se pudieron cargar los vehículos de los casos.');
  }

  const filasVehiculo = (vehiculos ?? []) as FilaVehiculo[];
  if (filasVehiculo.length === 0) return [];

  const [resultadoClientes, resultadoMecanicos] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nombre')
      .in('id', unicos(filasVehiculo.map(item => item.cliente_id))),
    supabase
      .from('perfiles')
      .select('id, nombre')
      .in('id', unicos(filasAsignacion.map(item => item.mecanico_id))),
  ]);

  if (resultadoClientes.error || resultadoMecanicos.error) {
    throw new Error('No se pudo completar la información de los casos.');
  }

  const clientesPorId = new Map(
    ((resultadoClientes.data ?? []) as FilaCliente[]).map(item => [item.id, item]),
  );
  const mecanicosPorId = new Map(
    ((resultadoMecanicos.data ?? []) as FilaPerfil[]).map(item => [item.id, item]),
  );
  const vehiculosPorId = new Map(filasVehiculo.map(item => [item.id, item]));
  const asignacionesPorCaso = new Map(filasAsignacion.map(item => [item.caso_id, item]));

  return filasCaso.flatMap(caso => {
    const vehiculo = vehiculosPorId.get(caso.vehiculo_id);
    const asignacion = asignacionesPorCaso.get(caso.id);
    if (!vehiculo || !asignacion) return [];

    return [{
      id: caso.id,
      cliente: clientesPorId.get(vehiculo.cliente_id)?.nombre ?? 'Cliente no disponible',
      vehiculo: [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') || 'Vehículo sin detalle',
      patente: vehiculo.patente ?? 'Sin patente',
      mecanico: mecanicosPorId.get(asignacion.mecanico_id)?.nombre ?? 'Mecánico no disponible',
      creadoEn: caso.creado_en,
      estado: caso.estado === 'diagnosticado' || caso.estado === 'cerrado'
        ? 'revisado' as const
        : 'no_revisado' as const,
    }];
  });
}

function unicos(valores: string[]): string[] {
  return [...new Set(valores)];
}
