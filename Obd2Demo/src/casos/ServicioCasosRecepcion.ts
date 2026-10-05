import type { ClienteTaller } from '../clientes/TiposCliente';
import { supabase } from '../servicios/clienteSupabase';
import type { VehiculoTaller } from '../vehiculos/TiposVehiculo';
import type { EstadoSnapshotDiagnostico } from '../diagnosticos/TiposSnapshotDiagnostico';
import type {
  CasoDiagnostico,
  EstadoCasoDiagnostico,
  PrioridadCasoDiagnostico,
} from './TiposCasoDiagnostico';

export interface CasoRecepcion {
  id: string;
  clienteId: string;
  vehiculoId: string;
  recepcionResponsableId: string;
  cliente: string;
  vehiculo: string;
  patente: string;
  vin: string | null;
  motivoIngreso: string;
  estado: EstadoCasoDiagnostico;
  prioridad: PrioridadCasoDiagnostico;
  mecanico: string | null;
  snapshotIngreso: { id: string; estado: EstadoSnapshotDiagnostico } | null;
  creadoEn: string;
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

interface FilaSnapshotIngreso {
  id: string;
  caso_id: string;
  estado: EstadoSnapshotDiagnostico;
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
  recepcion_responsable_id: string;
  prioridad: PrioridadCasoDiagnostico;
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
    recepcionResponsableId: caso.recepcionResponsableId,
    cliente: cliente.nombre,
    vehiculo: nombreVehiculo(vehiculo),
    patente: vehiculo.patente ?? 'Sin patente',
    vin: vehiculo.vin,
    motivoIngreso: caso.motivoIngreso,
    estado: caso.estado,
    prioridad: caso.prioridad,
    mecanico: null,
    snapshotIngreso: null,
    creadoEn: caso.creadoEn,
  };
}

export async function listarCasosRecepcion(): Promise<CasoRecepcion[]> {
  return consultarCasosRecepcion();
}

export async function listarCasosVehiculo(
  vehiculoId: string,
): Promise<CasoRecepcion[]> {
  const identificador = vehiculoId.trim();
  if (!identificador)
    throw new Error('Se necesita el identificador del vehiculo.');
  return consultarCasosRecepcion(undefined, identificador);
}

export function tieneDiagnosticoIngresoPendiente(caso: CasoRecepcion): boolean {
  return caso.estado === 'ingresado' && caso.snapshotIngreso === null;
}

export async function obtenerCasoRecepcion(
  casoId: string,
): Promise<CasoRecepcion | null> {
  const identificador = casoId.trim();
  if (!identificador) throw new Error('Se necesita el identificador del caso.');
  const casos = await consultarCasosRecepcion(identificador);
  return casos[0] ?? null;
}

async function consultarCasosRecepcion(
  casoId?: string,
  vehiculoId?: string,
): Promise<CasoRecepcion[]> {
  let consulta = supabase
    .from('casos_diagnosticos')
    .select(
      'id, vehiculo_id, recepcion_responsable_id, motivo_ingreso, estado, prioridad, creado_en',
    );
  // cuando vuelvo de asignar, consulto solo el caso que acabo de trabajar
  if (casoId) consulta = consulta.eq('id', casoId);
  // filtro en la base para no traer el historial de otros autos
  if (vehiculoId) consulta = consulta.eq('vehiculo_id', vehiculoId);
  const { data: casos, error: errorCasos } = await consulta.order('creado_en', {
    ascending: false,
  });

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
  const [resultadoClientes, resultadoAsignaciones, resultadoSnapshots] =
    await Promise.all([
      supabase
        .from('clientes')
        .select('id, nombre')
        .in('id', unicos(filasVehiculo.map(item => item.cliente_id))),
      supabase
        .from('asignaciones')
        .select('caso_id, mecanico_id')
        .in(
          'caso_id',
          filasCaso.map(item => item.id),
        )
        .eq('estado', 'activa'),
      // para el listado solo necesito saber que escaneo de ingreso tiene cada caso
      supabase
        .from('snapshots_diagnostico')
        .select('id, caso_id, estado')
        .in(
          'caso_id',
          filasCaso.map(item => item.id),
        )
        .eq('tipo', 'ingreso'),
    ]);

  if (resultadoSnapshots.error) {
    throw new Error('No se pudo consultar el escaneo inicial de los casos.');
  }
  if (resultadoClientes.error || resultadoAsignaciones.error) {
    throw new Error('No se pudo completar la informacion de los casos.');
  }

  const filasCliente = (resultadoClientes.data ?? []) as FilaCliente[];
  const filasAsignacion = (resultadoAsignaciones.data ??
    []) as FilaAsignacion[];
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
  const snapshotsPorCaso = new Map(
    ((resultadoSnapshots.data ?? []) as FilaSnapshotIngreso[]).map(item => [
      item.caso_id,
      { id: item.id, estado: item.estado },
    ]),
  );

  return filasCaso.flatMap(caso => {
    const vehiculo = vehiculosPorId.get(caso.vehiculo_id);
    if (!vehiculo) return [];

    const mecanicoId = asignacionesPorCaso.get(caso.id);
    return [
      {
        id: caso.id,
        clienteId: vehiculo.cliente_id,
        vehiculoId: vehiculo.id,
        recepcionResponsableId: caso.recepcion_responsable_id,
        cliente:
          clientesPorId.get(vehiculo.cliente_id) ?? 'Cliente no disponible',
        vehiculo: nombreVehiculo(vehiculo),
        patente: vehiculo.patente ?? 'Sin patente',
        vin: vehiculo.vin,
        motivoIngreso: caso.motivo_ingreso,
        estado: caso.estado,
        prioridad: caso.prioridad,
        mecanico: mecanicoId
          ? mecanicosPorId.get(mecanicoId) ?? 'Mecanico no disponible'
          : null,
        snapshotIngreso: snapshotsPorCaso.get(caso.id) ?? null,
        creadoEn: caso.creado_en,
      },
    ];
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
