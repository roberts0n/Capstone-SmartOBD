import type {
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
  RespuestaElm,
  ResultadoDeteccionPids,
} from '../tipos/ble';
import type { InformePruebaDtc } from '../obd/dtc/PruebaDtc';
import type {
  MotivoSnapshotParcial,
  NuevoSnapshotDiagnostico,
  SnapshotDiagnostico,
  TipoSnapshotDiagnostico,
} from './TiposSnapshotDiagnostico';

export type EtapaCapturaSnapshot =
  | 'preparando-escaner'
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
  etapa: 'deteccion-pids' | 'lectura-pid' | 'lectura-dtc';
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
}
