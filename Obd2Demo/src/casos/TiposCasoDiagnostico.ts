export type EstadoCasoDiagnostico =
  | 'ingresado'
  | 'diagnostico_inicial'
  | 'asignado'
  | 'en_revision'
  | 'diagnosticado'
  | 'cerrado';

export type PrioridadCasoDiagnostico =
  | 'baja'
  | 'normal'
  | 'alta'
  | 'urgente';

export interface CasoDiagnostico {
  id: string;
  tallerId: string;
  vehiculoId: string;
  motivoIngreso: string;
  sintomasInformados: string | null;
  estado: EstadoCasoDiagnostico;
  prioridad: PrioridadCasoDiagnostico;
  recepcionId: string;
  mecanicoAsignadoId: string | null;
  conclusionTecnica: string | null;
  creadoEn: string;
  actualizadoEn: string;
  cerradoEn: string | null;
}

export interface NuevoCasoDiagnostico {
  vehiculoId: string;
  motivoIngreso: string;
  sintomasInformados?: string | null;
  prioridad?: PrioridadCasoDiagnostico;
}
