export interface ClienteTaller {
  id: string;
  tallerId: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  observaciones: string | null;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface NuevoClienteTaller {
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  observaciones?: string | null;
}
