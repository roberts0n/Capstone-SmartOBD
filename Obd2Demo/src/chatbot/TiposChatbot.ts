import type { PerfilTaller } from '../tipos/usuarioTaller';

export type PerfilChatbot = Extract<PerfilTaller, 'recepcion' | 'mecanico'>;

export type EstadoCasoChatbot =
  | 'ingresado'
  | 'diagnostico_inicial'
  | 'asignado'
  | 'en_revision'
  | 'diagnosticado'
  | 'cerrado';

export type EstadoDtcChatbot = 'confirmado' | 'pendiente' | 'permanente';

export type OrigenLecturaChatbot = 'captura' | 'en-vivo';

export type ValorLecturaChatbot =
  | number
  | string
  | string[]
  | Record<string, unknown>;

export interface UsuarioPermisosChatbot {
  usuarioId: string;
  tallerId: string;
  perfil: PerfilTaller;
}

export interface CasoPermisosChatbot {
  id: string;
  tallerId: string;
  estado: EstadoCasoChatbot;
  recepcionId: string;
  mecanicoAsignadoId: string | null;
}

export interface PermisoChatbot {
  puedeVer: boolean;
  puedeEscribir: boolean;
  modo: PerfilChatbot | null;
  motivo: string;
}

export interface ClienteEntradaChatbot {
  id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  observaciones: string | null;
}

export interface VehiculoEntradaChatbot {
  id: string;
  clienteId: string;
  patente: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  combustible: string | null;
  vinEscaneado: string | null;
}

export interface CasoEntradaChatbot extends CasoPermisosChatbot {
  vehiculoId: string;
  motivoIngreso: string;
  sintomasInformados: string | null;
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente';
  fechaCreacion: string;
}

export interface DtcEntradaChatbot {
  casoId: string;
  codigo: string;
  estado: EstadoDtcChatbot;
  fecha: string;
  valido: boolean;
}

export interface LecturaPidEntradaChatbot {
  casoId: string;
  pid: string;
  nombre: string;
  valor: ValorLecturaChatbot | null;
  unidad: string | null;
  fecha: string;
  origen: OrigenLecturaChatbot;
  compatible: boolean;
  valida: boolean;
}

export interface ResumenCasoAnteriorEntradaChatbot {
  casoId: string;
  vehiculoId: string;
  fecha: string;
  motivoIngreso: string;
  dtc: string[];
  conclusionTecnica: string | null;
  cerrado: boolean;
}

export interface EntradaContextoChatbot {
  cliente: ClienteEntradaChatbot;
  vehiculo: VehiculoEntradaChatbot;
  caso: CasoEntradaChatbot;
  dtc: readonly DtcEntradaChatbot[];
  lecturas: readonly LecturaPidEntradaChatbot[];
  antecedentes: readonly ResumenCasoAnteriorEntradaChatbot[];
}

export interface VehiculoChatbot {
  id: string;
  patente: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  combustible: string | null;
  vin: string | null;
}

export interface CasoChatbot {
  id: string;
  estado: EstadoCasoChatbot;
  motivoIngreso: string;
  sintomasInformados: string | null;
  prioridad: CasoEntradaChatbot['prioridad'];
  fechaCreacion: string;
}

export interface DtcChatbot {
  codigo: string;
  estado: EstadoDtcChatbot;
  fecha: string;
}

export interface LecturaPidChatbot {
  pid: string;
  nombre: string;
  valor: ValorLecturaChatbot;
  unidad: string | null;
  fecha: string;
  origen: OrigenLecturaChatbot;
}

export interface ResumenCasoAnteriorChatbot {
  casoId: string;
  fecha: string;
  motivoIngreso: string;
  dtc: string[];
  conclusionTecnica: string | null;
}

export interface ContextoChatbot {
  vehiculo: VehiculoChatbot;
  caso: CasoChatbot;
  dtc: DtcChatbot[];
  lecturas: LecturaPidChatbot[];
  antecedentes: ResumenCasoAnteriorChatbot[];
}
