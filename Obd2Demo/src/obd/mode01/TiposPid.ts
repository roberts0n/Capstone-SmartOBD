export type CategoriaPid =
  | 'Motor y movimiento'
  | 'Combustible y emisiones'
  | 'Oxigeno y mezcla'
  | 'Temperaturas'
  | 'Estados y configuracion';

export interface ContextoFormulaPid {
  escalas?: readonly number[];
  escalaMaf?: number;
  cuatroBancos?: boolean;
  ajusteDosBancos?: boolean;
}

export interface ResultadoPid {
  valor: number | string | Record<string, unknown> | null;
  unidad: string | null;
}

export interface DefinicionPidMode01 {
  comando: string;
  nombre: string;
  categoria: CategoriaPid;
  bytesEsperados: number;
  bytesMaximos?: number;
  interpretar: (
    datos: readonly number[],
    contexto?: ContextoFormulaPid,
  ) => ResultadoPid;
}

// Contexto de una deteccion, nunca global: no debe pasar de un auto a otro.
export interface ContextoLecturaMode01 {
  pidsSoportados: readonly string[];
  respuestasConfiguracion: Readonly<Record<string, string>>;
}

export const entero16 = (datos: readonly number[], inicio = 0) =>
  datos[inicio] * 256 + datos[inicio + 1];
export const redondear = (valor: number, decimales = 2) =>
  Number(valor.toFixed(decimales));
export const porcentaje = (valor: number) => (valor * 100) / 255;
export const ajuste = (valor: number) => ((valor - 128) * 100) / 128;
export const hex = (valor: number) =>
  valor.toString(16).padStart(2, '0').toUpperCase();

export function simple(
  pid: number,
  nombre: string,
  categoria: CategoriaPid,
  bytesEsperados: number,
  unidad: string,
  calcular: (datos: readonly number[], contexto: ContextoFormulaPid) => number,
): DefinicionPidMode01 {
  return {
    comando: `01${hex(pid)}`,
    nombre,
    categoria,
    bytesEsperados,
    interpretar: (datos, contexto = {}) => ({
      valor: redondear(calcular(datos, contexto)),
      unidad,
    }),
  };
}
