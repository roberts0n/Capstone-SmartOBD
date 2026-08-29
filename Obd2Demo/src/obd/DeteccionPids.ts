/* eslint-disable no-bitwise */
import type { BloquePidsDetectado, ResultadoDeteccionPids } from '../tipos/ble';

const BASES_VALIDAS = [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0];
const PIDS_INTERPRETABLES = new Set(['0105', '010C']);
const MENSAJES_SIN_RESPUESTA = [
  'NO DATA',
  'UNABLE TO CONNECT',
  'BUS ERROR',
  'CAN ERROR',
  'STOPPED',
  '?',
];

export interface BloquePidsInterpretado extends BloquePidsDetectado {
  siguienteComando: string | null;
  respuestaCruda: string;
}

/** Interpreta una mascara Mode 01 de 32 bits y une respuestas de varias ECU. */
export function interpretarBloquePids(
  comando: string,
  respuestaCruda: string,
): BloquePidsInterpretado {
  const comandoNormalizado = comando.trim().toUpperCase();
  if (!/^01[0-9A-F]{2}$/.test(comandoNormalizado)) {
    throw new Error(`Comando de deteccion PID no valido: ${comando}.`);
  }
  const base = Number.parseInt(comandoNormalizado.slice(2), 16);
  if (!BASES_VALIDAS.includes(base)) {
    throw new Error(
      `${comandoNormalizado} no corresponde a un bloque de deteccion PID.`,
    );
  }

  const mascaras = extraerMascaras(respuestaCruda, base);
  if (mascaras.length === 0) {
    const mensajeElm = MENSAJES_SIN_RESPUESTA.find(mensaje =>
      respuestaCruda.toUpperCase().includes(mensaje),
    );
    throw new Error(
      mensajeElm
        ? `${comandoNormalizado} devolvio ${mensajeElm}.`
        : `No se encontro una respuesta 41 ${hex(
            base,
          )} con cuatro bytes de mascara.`,
    );
  }

  const mascaraUnificada = [0, 0, 0, 0];
  for (const mascara of mascaras) {
    for (let indice = 0; indice < mascaraUnificada.length; indice += 1) {
      mascaraUnificada[indice] |= mascara[indice];
    }
  }

  const pidsDeclarados: string[] = [];
  for (let indiceBit = 0; indiceBit < 32; indiceBit += 1) {
    const byte = mascaraUnificada[Math.floor(indiceBit / 8)];
    const mascaraBit = 1 << (7 - (indiceBit % 8));
    const pid = base + indiceBit + 1;
    if ((byte & mascaraBit) !== 0 && pid <= 0xff) {
      pidsDeclarados.push(`01${hex(pid)}`);
    }
  }

  const siguienteBase = base + 0x20;
  const siguienteComando =
    siguienteBase <= 0xe0 && pidsDeclarados.includes(`01${hex(siguienteBase)}`)
      ? `01${hex(siguienteBase)}`
      : null;

  return {
    comando: comandoNormalizado,
    mascaraHexadecimal: mascaraUnificada.map(hex).join(' '),
    pidsDeclarados,
    siguienteComando,
    respuestaCruda,
  };
}

/** Consolida los bloques y excluye los PID 20/40/... usados para continuar. */
export function consolidarDeteccionPids(
  bloques: readonly BloquePidsInterpretado[],
): ResultadoDeteccionPids {
  const pidsSoportados = [
    ...new Set(
      bloques
        .flatMap(bloque => bloque.pidsDeclarados)
        .filter(comando => !esPidContinuacion(comando)),
    ),
  ].sort();
  const pidsInterpretables = pidsSoportados.filter(pid =>
    PIDS_INTERPRETABLES.has(pid),
  );
  const pidsPendientes = pidsSoportados.filter(
    pid => !PIDS_INTERPRETABLES.has(pid),
  );

  return {
    cantidadPidsSoportados: pidsSoportados.length,
    cantidadInterpretables: pidsInterpretables.length,
    cantidadPendientes: pidsPendientes.length,
    pidsSoportados,
    pidsInterpretables,
    pidsPendientes,
    bloques: bloques.map(({ comando, mascaraHexadecimal, pidsDeclarados }) => ({
      comando,
      mascaraHexadecimal,
      pidsDeclarados,
    })),
  };
}

function extraerMascaras(respuesta: string, base: number): number[][] {
  const resultado: number[][] = [];
  const lineas = respuesta
    .replace(/>/g, '')
    .split(/[\r\n]+/)
    .map(linea => linea.trim())
    .filter(Boolean);

  for (const lineaOriginal of lineas) {
    let linea = lineaOriginal.toUpperCase().replace(/^\s*[0-9A-F]+:\s*/, '');
    const elementos = linea.split(/\s+/);
    if (
      elementos.length > 1 &&
      (/^[0-9A-F]{3}$/.test(elementos[0]) || /^[0-9A-F]{8}$/.test(elementos[0]))
    ) {
      linea = elementos.slice(1).join('');
    } else {
      linea = elementos.join('');
      // Una cabecera CAN de 11 bits sin espacios deja una cantidad impar de
      // digitos. Se elimina solo si el resto queda alineado en bytes.
      if (
        /^[0-9A-F]{3}/.test(linea) &&
        linea.length % 2 !== 0 &&
        (linea.length - 3) % 2 === 0
      ) {
        linea = linea.slice(3);
      }
    }
    if (!/^[0-9A-F]+$/.test(linea) || linea.length % 2 !== 0) {
      continue;
    }
    const bytes: number[] = [];
    for (let indice = 0; indice < linea.length; indice += 2) {
      bytes.push(Number.parseInt(linea.slice(indice, indice + 2), 16));
    }
    for (let indice = 0; indice + 5 < bytes.length; indice += 1) {
      if (bytes[indice] === 0x41 && bytes[indice + 1] === base) {
        resultado.push(bytes.slice(indice + 2, indice + 6));
        break;
      }
    }
  }
  return resultado;
}

function esPidContinuacion(comando: string): boolean {
  const pid = Number.parseInt(comando.slice(2), 16);
  return pid > 0 && pid % 0x20 === 0;
}

function hex(valor: number): string {
  return valor.toString(16).padStart(2, '0').toUpperCase();
}
