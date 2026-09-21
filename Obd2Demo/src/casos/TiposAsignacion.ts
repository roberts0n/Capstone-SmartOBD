import type {
  CasoDiagnostico,
  PrioridadCasoDiagnostico,
} from './TiposCasoDiagnostico';

export interface MecanicoAsignable {
  id: string;
  nombre: string;
  especialidad: string | null;
}

export interface NuevaAsignacionCaso {
  casoId: string;
  mecanicoId: string;
  prioridad?: PrioridadCasoDiagnostico;
  nota?: string | null;
}

export interface ResultadoAsignacionCaso {
  asignacionId: string;
  caso: CasoDiagnostico;
}
