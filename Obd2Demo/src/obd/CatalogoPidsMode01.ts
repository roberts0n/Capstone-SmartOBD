/* eslint-disable no-bitwise */
import type { TraduccionObd } from '../tipos/ble';

type ValorPidMode01 = number | string | Record<string, unknown>;

interface ResultadoPidMode01 {
  valor: ValorPidMode01;
  unidad: string | null;
}

export interface DefinicionPidMode01 {
  comando: string;
  nombre: string;
  bytesEsperados: number;
  interpretar: (datos: readonly number[]) => ResultadoPidMode01;
}

const PORCENTAJE = 100 / 255;

const CUMPLIMIENTO_OBD: Record<number, string> = {
  0: 'No disponible',
  1: 'OBD-II (CARB)',
  2: 'OBD (EPA)',
  3: 'OBD y OBD-II',
  4: 'OBD-I',
  5: 'No compatible con OBD',
  6: 'EOBD',
  7: 'EOBD y OBD-II',
  8: 'EOBD y OBD',
  9: 'EOBD, OBD y OBD-II',
  10: 'JOBD',
  11: 'JOBD y OBD-II',
  12: 'JOBD y EOBD',
  13: 'JOBD, EOBD y OBD-II',
  17: 'Diagnóstico del fabricante (EMD)',
  18: 'Diagnóstico mejorado del fabricante (EMD+)',
  19: 'HD OBD-C',
  20: 'HD OBD',
  21: 'WWH-OBD',
  23: 'HD EOBD-I',
  24: 'HD EOBD-I N',
  25: 'HD EOBD-II',
  26: 'HD EOBD-II N',
  28: 'Brasil OBD fase 1',
  29: 'Brasil OBD fase 2',
  30: 'KOBD',
  31: 'India OBD I',
  32: 'India OBD II',
  33: 'HD EOBD etapa VI',
};

const ESTADOS_COMBUSTIBLE: Array<[number, string]> = [
  [0x01, 'Lazo abierto por temperatura insuficiente del motor'],
  [0x02, 'Lazo cerrado usando sensores de oxígeno'],
  [0x04, 'Lazo abierto por carga o desaceleración del motor'],
  [0x08, 'Lazo abierto por falla del sistema'],
  [0x10, 'Lazo cerrado con falla en al menos un sensor de oxígeno'],
];

const MONITORES_CHISPA = [
  'Catalizador',
  'Catalizador calentado',
  'Sistema evaporativo',
  'Aire secundario',
  'Refrigerante de aire acondicionado',
  'Sensor de oxígeno',
  'Calentador del sensor de oxígeno',
  'EGR o VVT',
];

const MONITORES_COMPRESION = [
  'Catalizador NMHC',
  'NOx o SCR',
  'Monitor reservado',
  'Presión de sobrealimentación',
  'Monitor reservado 2',
  'Sensor de gases de escape',
  'Filtro de partículas',
  'EGR o VVT',
];

function definicionSimple(
  comando: string,
  nombre: string,
  bytesEsperados: number,
  unidad: string,
  calcular: (datos: readonly number[]) => number,
): DefinicionPidMode01 {
  return {
    comando,
    nombre,
    bytesEsperados,
    interpretar: datos => ({ valor: redondear(calcular(datos)), unidad }),
  };
}

export const CATALOGO_PIDS_MODE_01: readonly DefinicionPidMode01[] = [
  {
    comando: '0101',
    nombre: 'Estado del sistema desde borrado de DTC',
    bytesEsperados: 4,
    interpretar: interpretarEstadoMonitores,
  },
  {
    comando: '0103',
    nombre: 'Estado del sistema de combustible',
    bytesEsperados: 2,
    interpretar: interpretarEstadoCombustible,
  },
  definicionSimple(
    '0104',
    'Carga calculada del motor',
    1,
    '%',
    datos => datos[0] * PORCENTAJE,
  ),
  definicionSimple(
    '0105',
    'Temperatura del refrigerante',
    1,
    '°C',
    datos => datos[0] - 40,
  ),
  definicionSimple(
    '0106',
    'Ajuste corto de combustible banco 1',
    1,
    '%',
    datos => ((datos[0] - 128) * 100) / 128,
  ),
  definicionSimple(
    '0107',
    'Ajuste largo de combustible banco 1',
    1,
    '%',
    datos => ((datos[0] - 128) * 100) / 128,
  ),
  definicionSimple(
    '010B',
    'Presión del múltiple de admisión',
    1,
    'kPa',
    datos => datos[0],
  ),
  definicionSimple(
    '010C',
    'RPM del motor',
    2,
    'rpm',
    datos => (datos[0] * 256 + datos[1]) / 4,
  ),
  definicionSimple(
    '010D',
    'Velocidad del vehículo',
    1,
    'km/h',
    datos => datos[0],
  ),
  definicionSimple(
    '010E',
    'Avance de encendido',
    1,
    '°',
    datos => (datos[0] - 128) / 2,
  ),
  definicionSimple(
    '010F',
    'Temperatura del aire de admisión',
    1,
    '°C',
    datos => datos[0] - 40,
  ),
  definicionSimple(
    '0111',
    'Posición del acelerador',
    1,
    '%',
    datos => datos[0] * PORCENTAJE,
  ),
  {
    comando: '0113',
    nombre: 'Sensores de oxígeno presentes',
    bytesEsperados: 1,
    interpretar: interpretarSensoresOxigenoPresentes,
  },
  {
    comando: '0114',
    nombre: 'Sensor de oxígeno banco 1 sensor 1',
    bytesEsperados: 2,
    interpretar: datos => interpretarSensorOxigeno(datos, 'Banco 1 Sensor 1'),
  },
  {
    comando: '0115',
    nombre: 'Sensor de oxígeno banco 1 sensor 2',
    bytesEsperados: 2,
    interpretar: datos => interpretarSensorOxigeno(datos, 'Banco 1 Sensor 2'),
  },
  {
    comando: '011C',
    nombre: 'Norma OBD compatible',
    bytesEsperados: 1,
    interpretar: datos => ({
      valor:
        CUMPLIMIENTO_OBD[datos[0]] ??
        `Código de cumplimiento OBD ${datos[0]}`,
      unidad: null,
    }),
  },
  definicionSimple(
    '0121',
    'Distancia recorrida con MIL encendida',
    2,
    'km',
    datos => datos[0] * 256 + datos[1],
  ),
  definicionSimple(
    '012E',
    'Purga evaporativa comandada',
    1,
    '%',
    datos => datos[0] * PORCENTAJE,
  ),
  definicionSimple(
    '0130',
    'Ciclos de calentamiento desde borrado de DTC',
    1,
    'ciclos',
    datos => datos[0],
  ),
  definicionSimple(
    '0131',
    'Distancia desde borrado de DTC',
    2,
    'km',
    datos => datos[0] * 256 + datos[1],
  ),
  definicionSimple(
    '0145',
    'Posición relativa del acelerador',
    1,
    '%',
    datos => datos[0] * PORCENTAJE,
  ),
  definicionSimple(
    '0147',
    'Posición del acelerador B',
    1,
    '%',
    datos => datos[0] * PORCENTAJE,
  ),
  definicionSimple(
    '014C',
    'Actuador del acelerador comandado',
    1,
    '%',
    datos => datos[0] * PORCENTAJE,
  ),
];

const DEFINICIONES_POR_COMANDO = new Map(
  CATALOGO_PIDS_MODE_01.map(definicion => [definicion.comando, definicion]),
);

/** Busca metadatos sin exponer la estructura interna del catalogo. */
export function obtenerDefinicionPidMode01(
  comando: string,
): DefinicionPidMode01 | null {
  return DEFINICIONES_POR_COMANDO.get(normalizarComando(comando)) ?? null;
}

export function esPidMode01Interpretable(comando: string): boolean {
  return obtenerDefinicionPidMode01(comando) !== null;
}

/** Traduce un PID conocido y devuelve null cuando no pertenece al catalogo. */
export function traducirPidMode01(
  comando: string,
  respuestaCruda: string,
): TraduccionObd | null {
  const definicion = obtenerDefinicionPidMode01(comando);
  if (!definicion) {
    return null;
  }

  const pid = Number.parseInt(definicion.comando.slice(2), 16);
  const datos = extraerDatosPid(
    respuestaCruda,
    pid,
    definicion.bytesEsperados,
  );
  if (!datos) {
    return {
      valor: null,
      unidad: null,
      error: `No se encontró una respuesta válida 41 ${hex(pid)} con ${definicion.bytesEsperados} byte(s) de datos.`,
    };
  }

  const resultado = definicion.interpretar(datos);
  return { ...resultado, error: null };
}

function interpretarEstadoMonitores(
  datos: readonly number[],
): ResultadoPidMode01 {
  const [estadoDtc, estadoBasico, soportados, incompletos] = datos;
  const tipoEncendido = (estadoBasico & 0x08) !== 0 ? 'compresión' : 'chispa';
  const nombresAdicionales =
    tipoEncendido === 'chispa' ? MONITORES_CHISPA : MONITORES_COMPRESION;
  const monitores = [
    crearMonitor('Fallas de encendido', estadoBasico, 0, estadoBasico, 4),
    crearMonitor(
      'Sistema de combustible',
      estadoBasico,
      1,
      estadoBasico,
      5,
    ),
    crearMonitor(
      'Componentes integrales',
      estadoBasico,
      2,
      estadoBasico,
      6,
    ),
    ...nombresAdicionales.map((nombre, indice) =>
      crearMonitor(nombre, soportados, indice, incompletos, indice),
    ),
  ];

  return {
    valor: {
      milEncendida: (estadoDtc & 0x80) !== 0,
      cantidadDtc: estadoDtc & 0x7f,
      tipoEncendido,
      monitores,
    },
    unidad: null,
  };
}

function crearMonitor(
  nombre: string,
  byteSoportados: number,
  bitSoportado: number,
  byteIncompletos: number,
  bitIncompleto: number,
) {
  const soportado = (byteSoportados & (1 << bitSoportado)) !== 0;
  return {
    nombre,
    soportado,
    completado:
      soportado && (byteIncompletos & (1 << bitIncompleto)) === 0
        ? true
        : soportado
        ? false
        : null,
  };
}

function interpretarEstadoCombustible(
  datos: readonly number[],
): ResultadoPidMode01 {
  return {
    valor: {
      sistema1: describirEstadoCombustible(datos[0]),
      sistema2: describirEstadoCombustible(datos[1]),
    },
    unidad: null,
  };
}

function describirEstadoCombustible(valor: number): string[] {
  return ESTADOS_COMBUSTIBLE.filter(([mascara]) => (valor & mascara) !== 0).map(
    ([, descripcion]) => descripcion,
  );
}

function interpretarSensoresOxigenoPresentes(
  datos: readonly number[],
): ResultadoPidMode01 {
  const sensoresPresentes: string[] = [];
  for (let indice = 0; indice < 8; indice += 1) {
    if ((datos[0] & (1 << indice)) !== 0) {
      const banco = indice < 4 ? 1 : 2;
      const sensor = (indice % 4) + 1;
      sensoresPresentes.push(`Banco ${banco} Sensor ${sensor}`);
    }
  }
  return { valor: { sensoresPresentes }, unidad: null };
}

function interpretarSensorOxigeno(
  datos: readonly number[],
  sensor: string,
): ResultadoPidMode01 {
  return {
    valor: {
      sensor,
      voltaje: redondear(datos[0] / 200),
      unidadVoltaje: 'V',
      ajusteCombustible:
        datos[1] === 0xff
          ? null
          : redondear(((datos[1] - 128) * 100) / 128),
      unidadAjuste: '%',
    },
    unidad: null,
  };
}

// Cada linea se analiza por separado para no unir fragmentos de dos ECU.
function extraerDatosPid(
  respuesta: string,
  pid: number,
  cantidadEsperada: number,
): number[] | null {
  const lineas = respuesta
    .replace(/>/g, '')
    .split(/[\r\n]+/)
    .map(linea => linea.trim())
    .filter(Boolean);

  for (const lineaOriginal of lineas) {
    const bytes = extraerBytesLinea(lineaOriginal);
    for (let indice = 0; indice + 1 < bytes.length; indice += 1) {
      if (bytes[indice] === 0x41 && bytes[indice + 1] === pid) {
        const datos = bytes.slice(indice + 2, indice + 2 + cantidadEsperada);
        if (datos.length === cantidadEsperada) {
          return datos;
        }
      }
    }
  }
  return null;
}

function extraerBytesLinea(lineaOriginal: string): number[] {
  let linea = lineaOriginal.toUpperCase().replace(/^\s*[0-9A-F]+:\s*/, '');
  const elementos = linea.split(/\s+/);
  if (
    elementos.length > 1 &&
    (/^[0-9A-F]{3}$/.test(elementos[0]) ||
      /^[0-9A-F]{8}$/.test(elementos[0]))
  ) {
    linea = elementos.slice(1).join('');
  } else {
    linea = elementos.join('');
    if (
      /^[0-9A-F]{3}/.test(linea) &&
      linea.length % 2 !== 0 &&
      (linea.length - 3) % 2 === 0
    ) {
      linea = linea.slice(3);
    }
  }
  if (!/^[0-9A-F]+$/.test(linea) || linea.length % 2 !== 0) {
    return [];
  }

  const bytes: number[] = [];
  for (let indice = 0; indice < linea.length; indice += 2) {
    bytes.push(Number.parseInt(linea.slice(indice, indice + 2), 16));
  }
  return bytes;
}

function normalizarComando(comando: string): string {
  return comando.trim().toUpperCase();
}

function redondear(valor: number): number {
  return Number(valor.toFixed(2));
}

function hex(valor: number): string {
  return valor.toString(16).padStart(2, '0').toUpperCase();
}
