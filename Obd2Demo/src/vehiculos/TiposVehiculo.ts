export interface VehiculoTaller {
  id: string;
  tallerId: string;
  clienteId: string;
  vin: string | null;
  patente: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  combustible: string | null;
  observaciones: string | null;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface NuevoVehiculoTaller {
  clienteId: string;
  vin?: string | null;
  patente?: string | null;
  marca?: string | null;
  modelo?: string | null;
  anio?: number | null;
  combustible?: string | null;
  observaciones?: string | null;
}
