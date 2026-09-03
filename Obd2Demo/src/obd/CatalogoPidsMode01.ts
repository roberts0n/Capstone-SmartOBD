import type { TraduccionObd } from '../tipos/ble';
import { ESTADOS_MODE_01 } from './mode01/Estados';
import { MEDICIONES_MODE_01 } from './mode01/Mediciones';
import { OXIGENO_MODE_01 } from './mode01/Oxigeno';
import { extraerRespuestasPid } from './mode01/ExtraerRespuestaPid';
import { hex } from './mode01/TiposPid';
import type {
  ContextoFormulaPid,
  ContextoLecturaMode01,
  DefinicionPidMode01,
} from './mode01/TiposPid';
export type {
  DefinicionPidMode01,
  ContextoLecturaMode01,
} from './mode01/TiposPid';

// Punto de entrada estable: los consumidores no necesitan conocer las familias.
export const CATALOGO_PIDS_MODE_01: readonly DefinicionPidMode01[] = [
  ...MEDICIONES_MODE_01,
  ...OXIGENO_MODE_01,
  ...ESTADOS_MODE_01,
].sort((a, b) => a.comando.localeCompare(b.comando));

const DEFINICIONES_POR_COMANDO = new Map(
  CATALOGO_PIDS_MODE_01.map(definicion => [definicion.comando, definicion]),
);

export function obtenerDefinicionPidMode01(
  comando: string,
): DefinicionPidMode01 | null {
  return DEFINICIONES_POR_COMANDO.get(comando.trim().toUpperCase()) ?? null;
}

export function esPidMode01Interpretable(comando: string): boolean {
  return obtenerDefinicionPidMode01(comando) !== null;
}

/** Solo solicita configuracion que el vehiculo anuncio, una vez por deteccion. */
export function obtenerConsultasConfiguracion(
  pids: readonly string[],
): string[] {
  return ['011D', '014F', '0150'].filter(pid => pids.includes(pid));
}

function resolverContexto(
  pid: number,
  cabecera: string | null,
  contexto?: ContextoLecturaMode01,
): ContextoFormulaPid {
  if (!contexto) {
    return {};
  }
  const resultado: ContextoFormulaPid = {};
  const configurar = (comando: string, cantidad: number) => {
    const respuestas = extraerRespuestasPid(
      contexto.respuestasConfiguracion[comando] ?? '',
      Number.parseInt(comando.slice(2), 16),
    );
    // Las escalas pertenecen a una ECU. Sin cabeceras solo es seguro asociar una
    // respuesta unica de configuracion a una respuesta unica del PID consultado.
    const candidatas = respuestas.filter(
      respuesta =>
        respuesta.cabecera === cabecera && respuesta.datos.length === cantidad,
    );
    if (candidatas.length !== 1) {
      throw new Error(
        'No se pudo asociar la configuración ' +
          comando +
          ' a esta respuesta. Repite la detección; si hay varias ECU, usa Cabeceras ON (ATH1).',
      );
    }
    return candidatas[0].datos;
  };
  if (
    contexto.pidsSoportados.includes('014F') &&
    (pid === 0x0b ||
      pid === 0x44 ||
      (pid >= 0x24 && pid <= 0x2b) ||
      (pid >= 0x34 && pid <= 0x3b))
  ) {
    resultado.escalas = configurar('014F', 4);
  }
  if (pid === 0x10 && contexto.pidsSoportados.includes('0150')) {
    resultado.escalaMaf = configurar('0150', 4)[0];
  }
  resultado.cuatroBancos = contexto.pidsSoportados.includes('011D');
  if (
    resultado.cuatroBancos &&
    [6, 7, 8, 9, 0x55, 0x56, 0x57, 0x58].includes(pid)
  ) {
    const respuestas = extraerRespuestasPid(
      contexto.respuestasConfiguracion['011D'] ?? '',
      0x1d,
    );
    if (
      respuestas.length === 0 ||
      respuestas.some(respuesta => respuesta.datos.length !== 1)
    ) {
      throw new Error(
        'Falta una respuesta válida de 011D para determinar los bancos de combustible. Repite la detección.',
      );
    }
    // La presencia de bancos es del vehiculo y puede repartirse entre ECU.
    const divisor = [6, 7, 0x55, 0x56].includes(pid) ? 16 : 64;
    resultado.ajusteDosBancos = respuestas.some(
      respuesta => Math.floor(respuesta.datos[0] / divisor) % 4 !== 0,
    );
  } else if ([6, 7, 8, 9, 0x55, 0x56, 0x57, 0x58].includes(pid)) {
    resultado.ajusteDosBancos = false;
  }
  return resultado;
}

/** Traduce una respuesta completa sin mezclar lineas ni sustituir datos crudos. */
export function traducirPidMode01(
  comando: string,
  respuestaCruda: string,
  contexto?: ContextoLecturaMode01,
): TraduccionObd | null {
  const definicion = obtenerDefinicionPidMode01(comando);
  if (!definicion) {
    return null;
  }
  const pid = Number.parseInt(definicion.comando.slice(2), 16);
  const respuestas = extraerRespuestasPid(respuestaCruda, pid);
  let detalle = '';
  for (const respuesta of respuestas) {
    try {
      const configuracion = resolverContexto(pid, respuesta.cabecera, contexto);
      if (
        respuesta.cabecera === null &&
        respuestas.length > 1 &&
        (configuracion.escalas || configuracion.escalaMaf !== undefined)
      ) {
        throw new Error(
          'Varias respuestas sin cabeceras: no se pueden asociar las escalas por ECU. Activa ATH1 y repite la detección.',
        );
      }
      const minimo =
        definicion.bytesMaximos && configuracion.ajusteDosBancos
          ? 2
          : definicion.bytesEsperados;
      const maximo =
        definicion.bytesMaximos && configuracion.ajusteDosBancos !== undefined
          ? minimo
          : definicion.bytesMaximos ?? minimo;
      if (respuesta.datos.length < minimo || respuesta.datos.length > maximo) {
        continue;
      }
      return {
        ...definicion.interpretar(respuesta.datos, configuracion),
        error: null,
      };
    } catch (capturado) {
      detalle =
        capturado instanceof Error ? capturado.message : String(capturado);
    }
  }
  const mensajeElm = [
    'NO DATA',
    'UNABLE TO CONNECT',
    'BUS ERROR',
    'CAN ERROR',
    'STOPPED',
    '?',
  ].find(m => respuestaCruda.toUpperCase().includes(m));
  return {
    valor: null,
    unidad: null,
    error:
      detalle ||
      (mensajeElm
        ? definicion.comando +
          ': ' +
          mensajeElm +
          '. No hay una lectura válida.'
        : 'No se encontró una respuesta válida 41 ' +
          hex(pid) +
          ' con ' +
          definicion.bytesEsperados +
          (definicion.bytesMaximos ? ' a ' + definicion.bytesMaximos : '') +
          ' byte(s) de datos. No se unen líneas ni se completa con ceros.'),
  };
}
