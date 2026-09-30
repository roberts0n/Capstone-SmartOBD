import type { SesionTaller } from '../tipos/usuarioTaller';
import { supabase } from '../servicios/clienteSupabase';
import type {
  CatalogoPid,
  CodigoDtcSnapshot,
  EstadoSnapshotDiagnostico,
  ModoDtcSnapshot,
  MotivoSnapshotParcial,
  NuevoCodigoDtcSnapshot,
  NuevoSnapshotDiagnostico,
  NuevoValorPidSnapshot,
  ResumenSnapshotDiagnostico,
  SnapshotDiagnostico,
  TipoSnapshotDiagnostico,
  TipoValorPid,
  ValorJson,
  ValorPidSnapshot,
} from './TiposSnapshotDiagnostico';

interface FilaCatalogoPid {
  codigo: string;
  nombre: string;
  unidad: string | null;
  categoria: string;
  tipo_valor: TipoValorPid;
}

interface FilaSnapshotDiagnostico {
  id: string;
  taller_id: string;
  caso_id: string;
  secuencia: number;
  tipo: TipoSnapshotDiagnostico;
  estado: EstadoSnapshotDiagnostico;
  motivo_parcial: MotivoSnapshotParcial | null;
  realizado_por: string;
}

interface FilaValorPidSnapshot {
  id: string;
  snapshot_id: string;
  pid_codigo: string;
  valor: ValorJson;
}

interface FilaCodigoDtcSnapshot {
  id: string;
  snapshot_id: string;
  codigo: string;
  modo_obd: ModoDtcSnapshot;
  ecu: string | null;
}

const CAMPOS_CATALOGO = 'codigo, nombre, unidad, categoria, tipo_valor';
const CAMPOS_SNAPSHOT =
  'id, taller_id, caso_id, secuencia, tipo, estado, motivo_parcial, realizado_por';
const CAMPOS_VALOR_PID = 'id, snapshot_id, pid_codigo, valor';
const CAMPOS_CODIGO_DTC = 'id, snapshot_id, codigo, modo_obd, ecu';

export async function listarCatalogoPids(): Promise<CatalogoPid[]> {
  const { data, error } = await supabase
    .from('catalogo_pids')
    .select(CAMPOS_CATALOGO)
    .order('codigo', { ascending: true });

  if (error) {
    throw new Error('No se pudo recuperar el catalogo de PID.');
  }

  return ((data ?? []) as FilaCatalogoPid[]).map(convertirCatalogoPid);
}

export async function guardarSnapshotDiagnostico(
  entrada: NuevoSnapshotDiagnostico,
  sesion: SesionTaller,
): Promise<SnapshotDiagnostico> {
  const entradaNormalizada = validarYNormalizarSnapshot(entrada, sesion);

  // Dejo la escritura completa en una funcion de la base de datos para evitar
  // que quede un snapshot a medias si falla uno de sus PID o DTC.
  const { data, error } = await supabase.rpc('guardar_snapshot_diagnostico', {
    caso_objetivo: entradaNormalizada.casoId,
    tipo_nuevo: entradaNormalizada.tipo,
    estado_nuevo: entradaNormalizada.estado,
    motivo_parcial_nuevo: entradaNormalizada.motivoParcial,
    valores_nuevos: entradaNormalizada.valoresPid.map(valor => ({
      pidCodigo: valor.pidCodigo,
      valor: valor.valor,
    })),
    codigos_dtc_nuevos: entradaNormalizada.codigosDtc.map(codigo => ({
      codigo: codigo.codigo,
      modoObd: codigo.modoObd,
      ecu: codigo.ecu,
    })),
  });

  if (error || typeof data !== 'string') {
    throw new Error(mensajeErrorGuardado(error));
  }

  const snapshot = await obtenerSnapshotDiagnostico(data);

  if (!snapshot) {
    throw new Error(
      'El snapshot se guardo, pero no se pudo recuperar para mostrarlo.',
    );
  }

  return snapshot;
}

export async function listarSnapshotsCaso(
  casoId: string,
): Promise<ResumenSnapshotDiagnostico[]> {
  const identificador = validarIdentificador(casoId, 'caso');
  const { data, error } = await supabase
    .from('snapshots_diagnostico')
    .select(CAMPOS_SNAPSHOT)
    .eq('caso_id', identificador)
    .order('secuencia', { ascending: true });

  if (error) {
    throw new Error('No se pudieron recuperar los snapshots del caso.');
  }

  return ((data ?? []) as FilaSnapshotDiagnostico[]).map(convertirSnapshot);
}

export async function obtenerSnapshotDiagnostico(
  snapshotId: string,
): Promise<SnapshotDiagnostico | null> {
  const identificador = validarIdentificador(snapshotId, 'snapshot');
  const { data: filaSnapshot, error: errorSnapshot } = await supabase
    .from('snapshots_diagnostico')
    .select(CAMPOS_SNAPSHOT)
    .eq('id', identificador)
    .maybeSingle();

  if (errorSnapshot) {
    throw new Error('No se pudo recuperar el snapshot de diagnostico.');
  }
  if (!filaSnapshot) {
    return null;
  }

  // Ambos grupos dependen del mismo snapshot, pero no entre ellos. Por eso los
  // consulto juntos y reduzco la espera al abrir el detalle del diagnostico.
  const [respuestaValores, respuestaCodigos] = await Promise.all([
    supabase
      .from('valores_pid_snapshot')
      .select(CAMPOS_VALOR_PID)
      .eq('snapshot_id', identificador)
      .order('pid_codigo', { ascending: true }),
    supabase
      .from('codigos_dtc_snapshot')
      .select(CAMPOS_CODIGO_DTC)
      .eq('snapshot_id', identificador)
      .order('codigo', { ascending: true }),
  ]);

  if (respuestaValores.error || respuestaCodigos.error) {
    throw new Error('No se pudo recuperar el contenido del snapshot.');
  }

  return {
    ...convertirSnapshot(filaSnapshot as FilaSnapshotDiagnostico),
    valoresPid: (
      (respuestaValores.data ?? []) as FilaValorPidSnapshot[]
    ).map(convertirValorPid),
    codigosDtc: (
      (respuestaCodigos.data ?? []) as FilaCodigoDtcSnapshot[]
    ).map(convertirCodigoDtc),
  };
}

function validarYNormalizarSnapshot(
  entrada: NuevoSnapshotDiagnostico,
  sesion: SesionTaller,
): NuevoSnapshotDiagnostico {
  if (sesion.perfil !== 'recepcion' && sesion.perfil !== 'mecanico') {
    throw new Error('Solo recepcion o mecanico pueden guardar snapshots.');
  }
  if (!sesion.usuarioId.trim() || !sesion.tallerId.trim()) {
    throw new Error('La sesion no contiene los datos necesarios del taller.');
  }

  const casoId = validarIdentificador(entrada.casoId, 'caso');
  const motivoParcial = entrada.motivoParcial ?? null;

  if (entrada.estado === 'parcial' && !motivoParcial) {
    throw new Error('Indica por que el snapshot quedo parcial.');
  }
  if (entrada.estado === 'completo' && motivoParcial) {
    throw new Error('Un snapshot completo no debe tener motivo parcial.');
  }
  if (entrada.estado === 'completo' && entrada.valoresPid.length === 0) {
    throw new Error('Un snapshot completo debe contener al menos un PID.');
  }
  if (entrada.valoresPid.length > 256 || entrada.codigosDtc.length > 256) {
    throw new Error('El snapshot supera la cantidad maxima de registros.');
  }

  const valoresPid = entrada.valoresPid.map(normalizarValorPid);
  const codigosDtc = entrada.codigosDtc.map(normalizarCodigoDtc);

  revisarPidDuplicados(valoresPid);
  revisarDtcDuplicados(codigosDtc);

  return {
    casoId,
    tipo: entrada.tipo,
    estado: entrada.estado,
    motivoParcial,
    valoresPid,
    codigosDtc,
  };
}

function normalizarValorPid(valor: NuevoValorPidSnapshot): NuevoValorPidSnapshot {
  const pidCodigo = valor.pidCodigo.trim().toUpperCase();

  if (!/^01[0-9A-F]{2}$/.test(pidCodigo)) {
    throw new Error(`El codigo PID ${valor.pidCodigo} no es valido.`);
  }
  if (valor.valor === null || !esValorJson(valor.valor)) {
    throw new Error(`El valor del PID ${pidCodigo} no se puede guardar.`);
  }

  return { pidCodigo, valor: valor.valor };
}

function normalizarCodigoDtc(
  codigo: NuevoCodigoDtcSnapshot,
): Required<NuevoCodigoDtcSnapshot> {
  const codigoNormalizado = codigo.codigo.trim().toUpperCase();
  const ecu = codigo.ecu?.trim().toUpperCase() || null;

  if (!/^[PCBU][0-3][0-9A-F]{3}$/.test(codigoNormalizado)) {
    throw new Error(`El codigo DTC ${codigo.codigo} no es valido.`);
  }
  if (ecu && !/^[0-9A-F]{2,8}$/.test(ecu)) {
    throw new Error(`El identificador de ECU ${ecu} no es valido.`);
  }

  return {
    codigo: codigoNormalizado,
    modoObd: codigo.modoObd,
    ecu,
  };
}

function revisarPidDuplicados(valores: NuevoValorPidSnapshot[]): void {
  const codigos = new Set<string>();

  for (const valor of valores) {
    if (codigos.has(valor.pidCodigo)) {
      throw new Error(`El PID ${valor.pidCodigo} esta repetido.`);
    }
    codigos.add(valor.pidCodigo);
  }
}

function revisarDtcDuplicados(
  codigos: Required<NuevoCodigoDtcSnapshot>[],
): void {
  const identificadores = new Set<string>();

  for (const codigo of codigos) {
    const identificador = `${codigo.codigo}:${codigo.modoObd}:${codigo.ecu ?? ''}`;
    if (identificadores.has(identificador)) {
      throw new Error(`El DTC ${codigo.codigo} esta repetido.`);
    }
    identificadores.add(identificador);
  }
}

function esValorJson(valor: unknown, visitados = new Set<object>()): valor is ValorJson {
  if (
    valor === null ||
    typeof valor === 'string' ||
    typeof valor === 'boolean'
  ) {
    return true;
  }
  if (typeof valor === 'number') {
    return Number.isFinite(valor);
  }
  if (typeof valor !== 'object') {
    return false;
  }
  if (visitados.has(valor)) {
    return false;
  }

  visitados.add(valor);
  const valido = Array.isArray(valor)
    ? valor.every(elemento => esValorJson(elemento, visitados))
    : Object.values(valor).every(elemento => esValorJson(elemento, visitados));
  visitados.delete(valor);
  return valido;
}

function validarIdentificador(valor: string, nombre: string): string {
  const identificador = valor.trim();
  if (!identificador) {
    throw new Error(`Se necesita el identificador del ${nombre}.`);
  }
  return identificador;
}

function convertirCatalogoPid(fila: FilaCatalogoPid): CatalogoPid {
  return {
    codigo: fila.codigo,
    nombre: fila.nombre,
    unidad: fila.unidad,
    categoria: fila.categoria,
    tipoValor: fila.tipo_valor,
  };
}

function convertirSnapshot(
  fila: FilaSnapshotDiagnostico,
): ResumenSnapshotDiagnostico {
  return {
    id: fila.id,
    tallerId: fila.taller_id,
    casoId: fila.caso_id,
    secuencia: fila.secuencia,
    tipo: fila.tipo,
    estado: fila.estado,
    motivoParcial: fila.motivo_parcial,
    realizadoPor: fila.realizado_por,
  };
}

function convertirValorPid(fila: FilaValorPidSnapshot): ValorPidSnapshot {
  return {
    id: fila.id,
    snapshotId: fila.snapshot_id,
    pidCodigo: fila.pid_codigo,
    valor: fila.valor,
  };
}

function convertirCodigoDtc(fila: FilaCodigoDtcSnapshot): CodigoDtcSnapshot {
  return {
    id: fila.id,
    snapshotId: fila.snapshot_id,
    codigo: fila.codigo,
    modoObd: fila.modo_obd,
    ecu: fila.ecu,
  };
}

function mensajeErrorGuardado(error: unknown): string {
  const mensaje = (error as { message?: string } | null)?.message ?? '';

  if (mensaje.includes('recepcion solo puede guardar')) {
    return 'Recepcion solo puede guardar el snapshot de ingreso.';
  }
  if (mensaje.includes('mecanico solo puede guardar')) {
    return 'Mecanica solo puede guardar snapshots intermedios o de cierre.';
  }
  if (mensaje.includes('mecanico no asignado')) {
    return 'El mecanico debe tener una asignacion activa para este caso.';
  }
  if (mensaje.toLowerCase().includes('ya existe un snapshot de este tipo')) {
    return 'El caso ya tiene un snapshot de este tipo.';
  }
  if (
    mensaje.includes('PID no existe') ||
    mensaje.includes('PID que SmartOBD no interpreta')
  ) {
    return 'Uno de los PID no existe en el catalogo de la aplicacion.';
  }

  return 'No se pudo guardar el snapshot de diagnostico. Intenta nuevamente.';
}
