/* eslint-disable no-bitwise */
export type TipoLineaObd =
  | 'eco'
  | 'respuesta-dtc'
  | 'respuesta-obd'
  | 'mensaje-elm'
  | 'invalida';

export interface DiagnosticoLineaObd {
  numero: number;
  texto: string;
  cabecera: string | null;
  bytesObd: string[];
  tipo: TipoLineaObd;
  descripcion: string;
  codigosDtc: string[];
  advertencias: string[];
}

export interface AnalisisRespuestaObd {
  comando: string;
  respuestaEscapada: string;
  lineas: DiagnosticoLineaObd[];
  codigosDtc: string[];
  advertencias: string[];
}

const MENSAJES_ELM = [
  'NO DATA',
  'SEARCHING',
  'STOPPED',
  'UNABLE TO CONNECT',
  'BUS ERROR',
  'CAN ERROR',
  '?',
];

/** Separa la respuesta en lineas logicas antes de interpretar sus bytes. */
export function analizarRespuestaObd(
  comando: string,
  respuestaCruda: string,
): AnalisisRespuestaObd {
  const comandoNormalizado = comando.trim().toUpperCase();
  const textos = respuestaCruda
    .replace(/>/g, '')
    .split(/[\r\n]+/)
    .map(texto => texto.trim())
    .filter(Boolean);

  const lineas = textos.map((texto, indice) =>
    analizarLineaObd(indice + 1, texto, comandoNormalizado),
  );
  const codigosDtc = [...new Set(lineas.flatMap(linea => linea.codigosDtc))];
  const advertencias = lineas.flatMap(linea =>
    linea.advertencias.map(
      advertencia => `Linea ${linea.numero}: ${advertencia}`,
    ),
  );

  if (lineas.length === 0) {
    advertencias.push('La respuesta no contiene lineas analizables.');
  }

  return {
    comando: comandoNormalizado,
    respuestaEscapada: hacerVisiblesSeparadores(respuestaCruda),
    lineas,
    codigosDtc,
    advertencias,
  };
}

function analizarLineaObd(
  numero: number,
  texto: string,
  comando: string,
): DiagnosticoLineaObd {
  const mayusculas = texto.toUpperCase();
  const elementos = mayusculas.split(/\s+/);
  const tieneCabeceraCan =
    elementos.length > 1 &&
    (/^[0-9A-F]{3}$/.test(elementos[0]) ||
      /^[0-9A-F]{8}$/.test(elementos[0])) &&
    elementos.slice(1).every(elemento => /^[0-9A-F]{2}$/.test(elemento));
  const cabecera = tieneCabeceraCan ? elementos[0] : null;
  const compacto = (tieneCabeceraCan ? elementos.slice(1) : elementos).join('');

  if (compacto === comando.replace(/\s/g, '')) {
    return crearLinea(numero, texto, [], 'eco', 'Eco del comando enviado.');
  }

  if (MENSAJES_ELM.some(mensaje => mayusculas.includes(mensaje))) {
    return crearLinea(
      numero,
      texto,
      [],
      'mensaje-elm',
      'Mensaje de estado informado por ELM327.',
    );
  }

  if (comando.startsWith('AT')) {
    return crearLinea(
      numero,
      texto,
      [],
      'mensaje-elm',
      'Respuesta textual de un comando AT.',
    );
  }

  if (!/^[0-9A-F]+$/.test(compacto)) {
    return crearLinea(
      numero,
      texto,
      [],
      'invalida',
      'La linea no contiene solamente datos hexadecimales.',
      [],
      ['Texto hexadecimal no reconocido.'],
    );
  }

  if (compacto.length % 2 !== 0) {
    return crearLinea(
      numero,
      texto,
      separarParesCompletos(compacto),
      'invalida',
      'La linea contiene un numero impar de digitos hexadecimales.',
      [],
      ['Falta medio byte hexadecimal al final de la linea.'],
      cabecera,
    );
  }

  const bytesObd = separarParesCompletos(compacto);
  if (comando === '03') {
    return analizarLineaDtc(numero, texto, bytesObd, cabecera);
  }

  return crearLinea(
    numero,
    texto,
    bytesObd,
    'respuesta-obd',
    'Linea hexadecimal recibida desde ELM327.',
    [],
    [],
    cabecera,
  );
}

function analizarLineaDtc(
  numero: number,
  texto: string,
  bytesObd: string[],
  cabecera: string | null,
): DiagnosticoLineaObd {
  const indiceCabecera = bytesObd.indexOf('43');
  if (indiceCabecera < 0) {
    return crearLinea(
      numero,
      texto,
      bytesObd,
      'invalida',
      'La linea no contiene la cabecera de respuesta DTC 43.',
      [],
      ['Se esperaba una cabecera 43 para el comando 03.'],
      cabecera,
    );
  }

  const datosDtc = bytesObd.slice(indiceCabecera + 1);
  if (datosDtc.length % 2 !== 0) {
    return crearLinea(
      numero,
      texto,
      bytesObd,
      'respuesta-dtc',
      'Respuesta DTC incompleta; no se combina con la linea siguiente.',
      [],
      ['La cantidad de bytes DTC despues de 43 es impar.'],
      cabecera,
    );
  }

  const codigosDtc: string[] = [];
  for (let indice = 0; indice < datosDtc.length; indice += 2) {
    const primero = Number.parseInt(datosDtc[indice], 16);
    const segundo = Number.parseInt(datosDtc[indice + 1], 16);
    if (primero === 0 && segundo === 0) {
      continue;
    }
    codigosDtc.push(decodificarParDtc(primero, segundo));
  }

  return crearLinea(
    numero,
    texto,
    bytesObd,
    'respuesta-dtc',
    codigosDtc.length > 0
      ? 'Respuesta DTC valida.'
      : 'Respuesta DTC valida sin codigos almacenados.',
    codigosDtc,
    [],
    cabecera,
  );
}

function decodificarParDtc(primero: number, segundo: number): string {
  const sistema = ['P', 'C', 'B', 'U'][(primero >> 6) & 3];
  return `${sistema}${((primero >> 4) & 3).toString(16)}${(
    primero & 15
  ).toString(16)}${((segundo >> 4) & 15).toString(16)}${(segundo & 15).toString(
    16,
  )}`.toUpperCase();
}

function separarParesCompletos(compacto: string): string[] {
  const pares: string[] = [];
  for (let indice = 0; indice + 1 < compacto.length; indice += 2) {
    pares.push(compacto.slice(indice, indice + 2));
  }
  return pares;
}

function crearLinea(
  numero: number,
  texto: string,
  bytesObd: string[],
  tipo: TipoLineaObd,
  descripcion: string,
  codigosDtc: string[] = [],
  advertencias: string[] = [],
  cabecera: string | null = null,
): DiagnosticoLineaObd {
  return {
    numero,
    texto,
    cabecera,
    bytesObd,
    tipo,
    descripcion,
    codigosDtc,
    advertencias,
  };
}

function hacerVisiblesSeparadores(valor: string): string {
  return valor.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}
