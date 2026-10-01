import type { ClienteTaller } from '../clientes/TiposCliente';
import { supabase } from '../servicios/clienteSupabase';
import type { VehiculoTaller } from '../vehiculos/TiposVehiculo';
import type {
  CasoDiagnostico,
  EstadoCasoDiagnostico,
} from './TiposCasoDiagnostico';

export interface CasoRecepcion {
  id: string;
  clienteId: string;
  vehiculoId: string;
  cliente: string;
  vehiculo: string;
  patente: string;
  vin: string | null;
  motivoIngreso: string;
  estado: EstadoCasoDiagnostico;
  mecanico: string | null;
  creadoEn: string;
}

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
  vin: string | null;
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

interface FilaCasoRecepcion extends FilaCaso {
  motivo_ingreso: string;
}

interface FilaVehiculoRecepcion extends FilaVehiculo {
  anio: number | null;
}

export function prepararCasoRecepcion(
  caso: CasoDiagnostico,
  cliente: ClienteTaller,
  vehiculo: VehiculoTaller,
): CasoRecepcion {
  return {
    id: caso.id,
    clienteId: cliente.id,
    vehiculoId: vehiculo.id,
    cliente: cliente.nombre,
    vehiculo: nombreVehiculo(vehiculo),
    patente: vehiculo.patente ?? 'Sin patente',
    vin: vehiculo.vin,
    motivoIngreso: caso.motivoIngreso,
    estado: caso.estado,
    mecanico: null,
    creadoEn: caso.creadoEn,
  };
}

export async function listarCasosRecepcion(): Promise<CasoRecepcion[]> {
  const { data: casos, error: errorCasos } = await supabase
    .from('casos_diagnosticos')
    .select('id, vehiculo_id, motivo_ingreso, estado, creado_en')
    .order('creado_en', { ascending: false });

  if (errorCasos) {
    throw new Error('No se pudieron consultar los casos de recepcion.');
  }

  const filasCaso = (casos ?? []) as FilaCasoRecepcion[];
  if (filasCaso.length === 0) return [];

  const { data: vehiculos, error: errorVehiculos } = await supabase
    .from('vehiculos')
    .select('id, cliente_id, vin, patente, marca, modelo, anio')
    .in('id', unicos(filasCaso.map(item => item.vehiculo_id)));

  if (errorVehiculos) {
    throw new Error('No se pudieron cargar los vehiculos de los casos.');
  }

  const filasVehiculo = (vehiculos ?? []) as FilaVehiculoRecepcion[];
  const [resultadoClientes, resultadoAsignaciones] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nombre')
      .in('id', unicos(filasVehiculo.map(item => item.cliente_id))),
    supabase
      .from('asignaciones')
      .select('caso_id, mecanico_id')
      .in('caso_id', filasCaso.map(item => item.id))
      .eq('estado', 'activa'),
  ]);

  if (resultadoClientes.error || resultadoAsignaciones.error) {
    throw new Error('No se pudo completar la informacion de los casos.');
  }

  const filasCliente = (resultadoClientes.data ?? []) as FilaCliente[];
  const filasAsignacion = (resultadoAsignaciones.data ?? []) as FilaAsignacion[];
  const idsMecanico = unicos(filasAsignacion.map(item => item.mecanico_id));
  let filasMecanico: FilaPerfil[] = [];

  if (idsMecanico.length > 0) {
    const { data: mecanicos, error: errorMecanicos } = await supabase
      .from('perfiles')
      .select('id, nombre')
      .in('id', idsMecanico);

    if (errorMecanicos) {
      throw new Error('No se pudieron cargar los mecanicos asignados.');
    }
    filasMecanico = (mecanicos ?? []) as FilaPerfil[];
  }

  const clientesPorId = new Map(
    filasCliente.map(item => [item.id, item.nombre]),
  );
  const vehiculosPorId = new Map(filasVehiculo.map(item => [item.id, item]));
  const asignacionesPorCaso = new Map(
    filasAsignacion.map(item => [item.caso_id, item.mecanico_id]),
  );
  const mecanicosPorId = new Map(
    filasMecanico.map(item => [item.id, item.nombre]),
  );

  return filasCaso.flatMap(caso => {
    const vehiculo = vehiculosPorId.get(caso.vehiculo_id);
    if (!vehiculo) return [];

    const mecanicoId = asignacionesPorCaso.get(caso.id);
    return [{
      id: caso.id,
      clienteId: vehiculo.cliente_id,
      vehiculoId: vehiculo.id,
      cliente:
        clientesPorId.get(vehiculo.cliente_id) ?? 'Cliente no disponible',
      vehiculo: nombreVehiculo(vehiculo),
      patente: vehiculo.patente ?? 'Sin patente',
      vin: vehiculo.vin,
      motivoIngreso: caso.motivo_ingreso,
      estado: caso.estado,
      mecanico: mecanicoId
        ? mecanicosPorId.get(mecanicoId) ?? 'Mecanico no disponible'
        : null,
      creadoEn: caso.creado_en,
    }];
  });
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

function nombreVehiculo(
  vehiculo: Pick<VehiculoTaller, 'marca' | 'modelo' | 'anio'>,
): string {
  return (
    [vehiculo.marca, vehiculo.modelo, vehiculo.anio]
      .filter(Boolean)
      .join(' ') || 'Vehiculo sin detalle'
  );
}
