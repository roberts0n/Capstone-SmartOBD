import type { InformacionDispositivoBle } from './ble';

export interface CanalEscaner {
  uuidServicio: string;
  uuidCaracteristica: string;
}

// Solo se persisten dispositivos con una respuesta ATI reconocida.
export interface EscanerGuardado {
  id: string;
  nombre: string | null;
  nombreLocal: string | null;
  identificacionElm: string;
  verificadoEn: string;
  escritura: CanalEscaner;
  notificacion: CanalEscaner;
}

export type NivelCandidato =
  | 'guardado'
  | 'probable'
  | 'posible'
  | 'desconocido';

export interface CandidatoEscaner {
  dispositivo: InformacionDispositivoBle;
  nivel: NivelCandidato;
  motivos: string[];
  perfiles: string[];
}
