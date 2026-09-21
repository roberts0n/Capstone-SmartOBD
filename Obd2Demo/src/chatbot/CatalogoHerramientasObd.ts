import { obtenerDefinicionPidMode01 } from '../obd/CatalogoPidsMode01';

const COMANDO_POR_HERRAMIENTA = {
  obtener_rpm: '010C',
  obtener_temperatura_refrigerante: '0105',
  obtener_velocidad: '010D',
} as const;

export type NombreHerramientaObd = keyof typeof COMANDO_POR_HERRAMIENTA;

export interface DefinicionHerramientaObd {
  nombreHerramienta: NombreHerramientaObd;
  comando: string;
  nombreDato: string;
}

export function obtenerHerramientaObd(
  nombre: string,
): DefinicionHerramientaObd | null {
  if (!Object.prototype.hasOwnProperty.call(COMANDO_POR_HERRAMIENTA, nombre)) {
    return null;
  }

  const nombreHerramienta = nombre as NombreHerramientaObd;
  const comando = COMANDO_POR_HERRAMIENTA[nombreHerramienta];
  const definicionPid = obtenerDefinicionPidMode01(comando);
  if (!definicionPid) {
    throw new Error(`Falta la definicion Mode 01 para ${comando}.`);
  }

  return {
    nombreHerramienta,
    comando,
    nombreDato: definicionPid.nombre,
  };
}

export function listarHerramientasObd(): DefinicionHerramientaObd[] {
  return Object.keys(COMANDO_POR_HERRAMIENTA).map(nombre => {
    const herramienta = obtenerHerramientaObd(nombre);
    if (!herramienta) {
      throw new Error(`No se pudo preparar la herramienta ${nombre}.`);
    }
    return herramienta;
  });
}
