import { analizarRespuestaObd } from '../AnalisisRespuestaObd';
import {
  decodificarDtc,
  interpretarDtc,
  type ComandoDtc,
  type ContextoDtc,
} from './InterpretarDtc';

interface ResultadoHistorico {
  estado: 'experimental' | 'invalida' | 'no-aplica';
  codigos: string[];
  advertencias: string[];
}

/** Replica SOLO el algoritmo DTC de cfdce32; nunca es fuente del diagnostico. */
export function interpretarDtcOriginal(
  comando: ComandoDtc,
  respuesta: string,
): ResultadoHistorico {
  if (comando !== '03') {
    return {
      estado: 'no-aplica',
      codigos: [],
      advertencias: ['La version original solamente interpretaba 03.'],
    };
  }
  const secuencias =
    respuesta.toUpperCase().match(/[0-9A-F]{2}(?:\s*[0-9A-F]{2})+/g) ?? [];
  const bytes = secuencias.flatMap(secuencia => {
    const compacto = secuencia.replace(/\s/g, '');
    return (compacto.match(/../g) ?? []).map(byte => Number.parseInt(byte, 16));
  });
  const inicio = bytes.indexOf(0x43);
  const codigos: string[] = [];
  for (
    let indice = inicio + 1;
    inicio >= 0 && indice + 1 < bytes.length;
    indice += 2
  ) {
    if (bytes[indice] !== 0 || bytes[indice + 1] !== 0) {
      codigos.push(decodificarDtc(bytes[indice], bytes[indice + 1]));
    }
  }
  return {
    estado: inicio >= 0 ? 'experimental' : 'invalida',
    codigos,
    advertencias: [
      'EXPERIMENTAL: une lineas y puede fabricar DTC. No utilizar para diagnosticar.',
    ],
  };
}

/** Todos los metodos reciben la MISMA cadena; no se vuelve a consultar el auto. */
export function compararDtc(
  comando: ComandoDtc,
  respuesta: string,
  contexto: ContextoDtc,
) {
  const analisisActual =
    comando === '03' ? analizarRespuestaObd(comando, respuesta) : null;
  return {
    original: interpretarDtcOriginal(comando, respuesta),
    porLineas: {
      estado: analisisActual ? 'referencia-historica' : 'no-aplica',
      codigos: analisisActual?.codigosDtc ?? [],
      advertencias: analisisActual?.advertencias ?? [
        'El metodo por lineas solo interpretaba 03.',
      ],
      analisis: analisisActual,
    },
    corregido: interpretarDtc(comando, respuesta, contexto),
  };
}

export type ComparacionDtc = ReturnType<typeof compararDtc>;
