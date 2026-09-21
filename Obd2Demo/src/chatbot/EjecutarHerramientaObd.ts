import type { ContextoLecturaMode01 } from '../obd/CatalogoPidsMode01';
import { traducirRespuestaObd } from '../obd/ServicioElm327';
import type { RespuestaElm, ResultadoJsonObd } from '../tipos/ble';
import { adaptarResultadoObd } from './AdaptarResultadoObd';
import {
  obtenerHerramientaObd,
  type NombreHerramientaObd,
} from './CatalogoHerramientasObd';
import type { LecturaPidEntradaChatbot } from './TiposChatbot';

export type TipoErrorHerramientaObd =
  | 'herramienta-no-permitida'
  | 'escaner-desconectado'
  | 'pid-no-compatible'
  | 'error-comunicacion'
  | 'lectura-invalida';

export type ResultadoEjecucionHerramientaObd =
  | {
      exito: true;
      herramienta: NombreHerramientaObd;
      lectura: LecturaPidEntradaChatbot;
    }
  | {
      exito: false;
      tipoError: TipoErrorHerramientaObd;
      mensaje: string;
    };

export interface OpcionesEjecutarHerramientaObd {
  herramienta: string;
  casoId: string;
  pidsCompatibles: readonly string[];
  conectado: () => boolean;
  enviar: (comando: string) => Promise<RespuestaElm>;
  contextoMode01?: ContextoLecturaMode01;
  obtenerFecha?: () => string;
}

export async function ejecutarHerramientaObd(
  opciones: OpcionesEjecutarHerramientaObd,
): Promise<ResultadoEjecucionHerramientaObd> {
  const herramienta = obtenerHerramientaObd(opciones.herramienta);
  if (!herramienta) {
    return error(
      'herramienta-no-permitida',
      'La herramienta solicitada no esta habilitada.',
    );
  }

  if (!opciones.conectado()) {
    return error(
      'escaner-desconectado',
      'Conecta el escaner antes de solicitar una lectura en vivo.',
    );
  }

  const pidsCompatibles = new Set(
    opciones.pidsCompatibles.map(pid => pid.trim().toUpperCase()),
  );
  if (!pidsCompatibles.has(herramienta.comando)) {
    return error(
      'pid-no-compatible',
      `El vehiculo no declaro compatible el PID ${herramienta.comando}.`,
    );
  }

  try {
    const respuesta = await opciones.enviar(herramienta.comando);
    const traduccion = traducirRespuestaObd(
      herramienta.comando,
      respuesta.textoAscii,
      opciones.contextoMode01,
    );
    const resultado: ResultadoJsonObd = {
      fecha: opciones.obtenerFecha?.() ?? new Date().toISOString(),
      dispositivo: null,
      comando: herramienta.comando,
      respuestaCruda: respuesta.textoAscii,
      datoTraducido: traduccion.valor,
      unidad: traduccion.unidad,
      erroresComunicacion: traduccion.error ? [traduccion.error] : [],
    };
    const lectura = adaptarResultadoObd({
      casoId: opciones.casoId,
      resultado,
      pidsCompatibles: opciones.pidsCompatibles,
      origen: 'en-vivo',
    });

    if (!lectura.valida) {
      return error(
        'lectura-invalida',
        traduccion.error ?? 'El escaner no entrego una lectura valida.',
      );
    }

    return {
      exito: true,
      herramienta: herramienta.nombreHerramienta,
      lectura,
    };
  } catch (capturado) {
    const detalle =
      capturado instanceof Error ? capturado.message : String(capturado);
    return error(
      'error-comunicacion',
      `No se pudo completar la lectura: ${detalle}`,
    );
  }
}

function error(
  tipoError: TipoErrorHerramientaObd,
  mensaje: string,
): ResultadoEjecucionHerramientaObd {
  return { exito: false, tipoError, mensaje };
}
