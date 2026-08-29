/* eslint-disable no-bitwise */

export interface DisponibilidadVin {
  disponible: boolean;
  mascaraHexadecimal: string;
}

const MENSAJES_SIN_RESPUESTA = [
  'NO DATA',
  'UNABLE TO CONNECT',
  'BUS ERROR',
  'CAN ERROR',
  'STOPPED',
  '?',
];

/** Comprueba el bit de Mode 09 PID 02 dentro de la respuesta a 0900. */
export function comprobarDisponibilidadVin(
  respuestaCruda: string,
): DisponibilidadVin {
  const mascaras = extraerSecuencias(respuestaCruda, [0x49, 0x00], 4);
  if (mascaras.length === 0) {
    throw new Error(describirRespuestaAusente('49 00', respuestaCruda));
  }

  const mascaraUnificada = [0, 0, 0, 0];
  for (const mascara of mascaras) {
    for (let indice = 0; indice < mascaraUnificada.length; indice += 1) {
      mascaraUnificada[indice] |= mascara[indice];
    }
  }

  return {
    // PID 01 ocupa el bit 7; PID 02 ocupa el bit 6 del primer byte.
    disponible: (mascaraUnificada[0] & 0x40) !== 0,
    mascaraHexadecimal: mascaraUnificada.map(aHex).join(' '),
  };
}

/** Reconstruye y valida un VIN desde respuestas CAN o protocolos anteriores. */
export function decodificarVin(respuestaCruda: string): string {
  const candidatos = [
    ...extraerVinCanFormateado(respuestaCruda),
    ...extraerVinPorRegistros(respuestaCruda),
    ...extraerVinCanCrudo(respuestaCruda),
    ...extraerVinContinuo(respuestaCruda),
  ];
  const vinsValidos = [
    ...new Set(
      candidatos
        .map(convertirBytesAVin)
        .filter((vin): vin is string => vin !== null),
    ),
  ];

  if (vinsValidos.length === 1) {
    return vinsValidos[0];
  }
  if (vinsValidos.length > 1) {
    throw new Error(
      `La respuesta contiene VIN distintos: ${vinsValidos.join(', ')}.`,
    );
  }
  throw new Error(
    describirRespuestaAusente(
      '49 02 seguido de un VIN valido de 17 caracteres',
      respuestaCruda,
    ),
  );
}

/** CAN con formato ELM activo: 014, luego lineas 0:, 1:, 2:. */
function extraerVinCanFormateado(respuesta: string): number[][] {
  const grupos: number[][] = [];
  let actual: number[] | null = null;
  for (const linea of obtenerLineas(respuesta)) {
    const coincidencia = linea.match(/^([0-9A-F]):\s*(.+)$/i);
    if (!coincidencia) {
      continue;
    }
    const secuencia = Number.parseInt(coincidencia[1], 16);
    const bytes = extraerBytesLinea(coincidencia[2]);
    if (secuencia === 0) {
      if (actual) {
        grupos.push(actual);
      }
      actual = [...bytes];
    } else if (actual) {
      actual.push(...bytes);
    }
  }
  if (actual) {
    grupos.push(actual);
  }
  return grupos.map(extraerCargaVin).filter(noNulo);
}

/** J1850/K-Line: cada registro repite 49 02 y agrega su numero de orden. */
function extraerVinPorRegistros(respuesta: string): number[][] {
  const grupos: Array<Map<number, number[]>> = [];
  let actual = new Map<number, number[]>();
  for (const linea of obtenerLineas(respuesta)) {
    const bytes = extraerBytesLinea(linea);
    const indice = buscarSecuencia(bytes, [0x49, 0x02]);
    if (indice < 0 || bytes.length <= indice + 2) {
      continue;
    }
    const orden = bytes[indice + 2];
    if (orden === 1 && actual.has(1)) {
      grupos.push(actual);
      actual = new Map<number, number[]>();
    }
    actual.set(orden, bytes.slice(indice + 3));
  }
  if (actual.size > 0) {
    grupos.push(actual);
  }

  return grupos.map(grupo => {
    const carga = [...grupo.entries()]
      .sort(([ordenA], [ordenB]) => ordenA - ordenB)
      .flatMap(([, bytes]) => bytes);
    return quitarRellenoInicial(carga);
  });
}

/** CAN sin formato: primer frame 10 xx y continuaciones 21, 22, etc. */
function extraerVinCanCrudo(respuesta: string): number[][] {
  const grupos: number[][] = [];
  let actual: number[] | null = null;
  let longitudEsperada = 0;
  for (const linea of obtenerLineas(respuesta)) {
    const bytes = extraerBytesLinea(linea);
    const indicePrimerFrame = bytes.findIndex(
      (byte, indice) => (byte & 0xf0) === 0x10 && indice + 1 < bytes.length,
    );
    if (indicePrimerFrame >= 0) {
      if (actual) {
        grupos.push(actual.slice(0, longitudEsperada));
      }
      longitudEsperada =
        ((bytes[indicePrimerFrame] & 0x0f) << 8) | bytes[indicePrimerFrame + 1];
      actual = bytes.slice(indicePrimerFrame + 2);
      continue;
    }
    const indiceContinuacion = bytes.findIndex(byte => (byte & 0xf0) === 0x20);
    if (actual && indiceContinuacion >= 0) {
      actual.push(...bytes.slice(indiceContinuacion + 1));
    }
  }
  if (actual) {
    grupos.push(actual.slice(0, longitudEsperada));
  }
  return grupos.map(extraerCargaVin).filter(noNulo);
}

/** Respuesta ya unificada por el adaptador en una sola linea. */
function extraerVinContinuo(respuesta: string): number[][] {
  const candidatos: number[][] = [];
  for (const linea of obtenerLineas(respuesta)) {
    const carga = extraerCargaVin(extraerBytesLinea(linea));
    if (carga) {
      candidatos.push(carga);
    }
  }
  return candidatos;
}

function extraerCargaVin(bytes: number[]): number[] | null {
  const indice = buscarSecuencia(bytes, [0x49, 0x02]);
  if (indice < 0 || bytes.length <= indice + 3) {
    return null;
  }
  // El byte posterior a 49 02 indica la cantidad de elementos informados.
  return quitarRellenoInicial(bytes.slice(indice + 3));
}

function convertirBytesAVin(bytes: number[]): string | null {
  const sinRelleno = quitarRellenoInicial(bytes);
  if (sinRelleno.length < 17) {
    return null;
  }
  const vin = String.fromCharCode(...sinRelleno.slice(0, 17)).toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : null;
}

function quitarRellenoInicial(bytes: number[]): number[] {
  const primerDato = bytes.findIndex(byte => byte !== 0x00);
  return primerDato < 0 ? [] : bytes.slice(primerDato);
}

function extraerSecuencias(
  respuesta: string,
  cabecera: readonly number[],
  cantidadDatos: number,
): number[][] {
  const resultados: number[][] = [];
  for (const linea of obtenerLineas(respuesta)) {
    const bytes = extraerBytesLinea(linea);
    const indice = buscarSecuencia(bytes, cabecera);
    if (
      indice >= 0 &&
      bytes.length >= indice + cabecera.length + cantidadDatos
    ) {
      resultados.push(
        bytes.slice(
          indice + cabecera.length,
          indice + cabecera.length + cantidadDatos,
        ),
      );
    }
  }
  return resultados;
}

function obtenerLineas(respuesta: string): string[] {
  return respuesta
    .replace(/>/g, '')
    .split(/[\r\n]+/)
    .map(linea => linea.trim())
    .filter(linea => linea.length > 0 && !/^09\s*0[02]$/i.test(linea));
}

function extraerBytesLinea(linea: string): number[] {
  const sinEtiqueta = linea.replace(/^([0-9A-F]):\s*/i, '');
  const elementos = sinEtiqueta.split(/\s+/);
  if (elementos.length === 1 && /^[0-9A-F]+$/i.test(elementos[0])) {
    const compacto = elementos[0];
    if (compacto.length % 2 !== 0) {
      return [];
    }
    const bytes: number[] = [];
    for (let indice = 0; indice < compacto.length; indice += 2) {
      bytes.push(Number.parseInt(compacto.slice(indice, indice + 2), 16));
    }
    return bytes;
  }
  // Los tokens de 3 u 8 digitos suelen ser cabeceras y no son bytes de datos.
  return elementos
    .filter(elemento => /^[0-9A-F]{2}$/i.test(elemento))
    .map(elemento => Number.parseInt(elemento, 16));
}

function buscarSecuencia(
  bytes: readonly number[],
  esperados: readonly number[],
): number {
  return bytes.findIndex((_, indice) =>
    esperados.every(
      (esperado, desplazamiento) => bytes[indice + desplazamiento] === esperado,
    ),
  );
}

function describirRespuestaAusente(
  esperado: string,
  respuestaCruda: string,
): string {
  const mensajeElm = MENSAJES_SIN_RESPUESTA.find(mensaje =>
    respuestaCruda.toUpperCase().includes(mensaje),
  );
  return mensajeElm
    ? `La consulta VIN devolvio ${mensajeElm}.`
    : `No se encontro ${esperado} en la respuesta VIN.`;
}

function noNulo(valor: number[] | null): valor is number[] {
  return valor !== null;
}

function aHex(valor: number): string {
  return valor.toString(16).padStart(2, '0').toUpperCase();
}
