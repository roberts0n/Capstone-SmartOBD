import type {
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
  RespuestaElm,
  ResultadoDeteccionPids,
} from '../tipos/ble';
import type { InformePruebaDtc } from '../obd/dtc/PruebaDtc';
import type { VerificacionMotor } from './VerificarCondicionMotor';

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

export type EtapaCapturaSnapshot =
  | 'preparando-escaner'
  | 'verificando-motor'
  | 'leyendo-vin'
  | 'detectando-pids'
  | 'leyendo-pids'
  | 'leyendo-dtc'
  | 'preparando-snapshot'
  | 'guardando';

export interface ProgresoCapturaSnapshot {
  etapa: EtapaCapturaSnapshot;
  actual: number | null;
  total: number | null;
  mensaje: string;
}

export interface FalloCapturaSnapshot {
  etapa:
    | 'condicion-motor'
    | 'deteccion-pids'
    | 'lectura-pid'
    | 'lectura-dtc';
  comando: string | null;
  mensaje: string;
}

export interface OpcionesCapturaSnapshot {
  casoId: string;
  tipo: TipoSnapshotDiagnostico;
  dispositivo: InformacionDispositivoBle;
  escritura: InformacionCaracteristicaGatt;
  notificacion: InformacionCaracteristicaGatt;
  versionAplicacion: string;
  motivoParcialInicial?: MotivoSnapshotParcial | null;
  enviar: (comando: string) => Promise<RespuestaElm>;
  conectado: () => boolean;
  sincronizado: () => boolean;
  cancelado: () => boolean;
  alProgresar?: (progreso: ProgresoCapturaSnapshot) => void;
}

export interface ResultadoCapturaSnapshot {
  snapshot: NuevoSnapshotDiagnostico;
  cancelada: boolean;
  deteccion: ResultadoDeteccionPids | null;
  pidsLeidos: string[];
  fallos: FalloCapturaSnapshot[];
  informeDtc: InformePruebaDtc | null;
}

export interface ResultadoCapturaGuardada {
  captura: ResultadoCapturaSnapshot;
  snapshotGuardado: SnapshotDiagnostico;
  vinLeido?: string | null;
  advertencias?: string[];
  verificacionMotorInicial?: VerificacionMotor | null;
  verificacionMotorFinal?: VerificacionMotor | null;
}

export type CondicionMotorSnapshot = 'en_marcha' | 'no_arranca';
