export type TipoValorPid = 'numerico' | 'texto' | 'estructurado';

export type TipoSnapshotDiagnostico = 'ingreso' | 'intermedio' | 'cierre';

export type EstadoSnapshotDiagnostico = 'completo' | 'parcial';

export type MotivoSnapshotParcial =
  | 'motor_no_arranca'
  | 'lecturas_incompletas'
  | 'conexion_interrumpida'
  | 'otro';

export type ModoDtcSnapshot = '03' | '07' | '0A';

export type ValorJson =
  | string
  | number
  | boolean
  | null
  | ValorJson[]
  | { [clave: string]: ValorJson };

export interface CatalogoPid {
  codigo: string;
  nombre: string;
  unidad: string | null;
  categoria: string;
  tipoValor: TipoValorPid;
}

export interface NuevoValorPidSnapshot {
  pidCodigo: string;
  valor: ValorJson;
}

export interface NuevoCodigoDtcSnapshot {
  codigo: string;
  modoObd: ModoDtcSnapshot;
  ecu?: string | null;
}

export interface NuevoSnapshotDiagnostico {
  casoId: string;
  tipo: TipoSnapshotDiagnostico;
  estado: EstadoSnapshotDiagnostico;
  motivoParcial?: MotivoSnapshotParcial | null;
  valoresPid: NuevoValorPidSnapshot[];
  codigosDtc: NuevoCodigoDtcSnapshot[];
}

export interface ValorPidSnapshot extends NuevoValorPidSnapshot {
  id: string;
  snapshotId: string;
}

export interface CodigoDtcSnapshot {
  id: string;
  snapshotId: string;
  codigo: string;
  modoObd: ModoDtcSnapshot;
  ecu: string | null;
}

export interface ResumenSnapshotDiagnostico {
  id: string;
  tallerId: string;
  casoId: string;
  secuencia: number;
  tipo: TipoSnapshotDiagnostico;
  estado: EstadoSnapshotDiagnostico;
  motivoParcial: MotivoSnapshotParcial | null;
  realizadoPor: string;
}

export interface SnapshotDiagnostico extends ResumenSnapshotDiagnostico {
  valoresPid: ValorPidSnapshot[];
  codigosDtc: CodigoDtcSnapshot[];
}
