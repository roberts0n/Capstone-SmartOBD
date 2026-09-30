import type { ContextoLecturaMode01 } from './CatalogoPidsMode01';
import {
  obtenerConsultasConfiguracion,
  traducirPidMode01,
} from './CatalogoPidsMode01';
import {
  consolidarDeteccionPids,
  interpretarBloquePids,
  type BloquePidsInterpretado,
} from './DeteccionPids';
import type { RespuestaElm, ResultadoDeteccionPids } from '../tipos/ble';

export interface ProgresoDeteccionPids {
  etapa: 'bloques' | 'configuracion';
  momento: 'inicio' | 'resultado';
  comando: string;
  mensaje: string;
}

export interface CapturaParcialDeteccionPids {
  bloques: BloquePidsInterpretado[];
  respuestasConfiguracion: Record<string, string>;
  advertenciasConfiguracion: string[];
}

export interface ResultadoEjecucionDeteccionPids
  extends CapturaParcialDeteccionPids {
  deteccion: ResultadoDeteccionPids;
  contextoMode01: ContextoLecturaMode01;
}

export interface OpcionesEjecutarDeteccionPids {
  enviar: (comando: string) => Promise<RespuestaElm>;
  conectado?: () => boolean;
  sincronizado?: () => boolean;
  cancelado?: () => boolean;
  alProgresar?: (progreso: ProgresoDeteccionPids) => void;
}

export class ErrorEjecucionDeteccionPids extends Error {
  constructor(
    mensaje: string,
    public readonly captura: CapturaParcialDeteccionPids,
  ) {
    super(mensaje);
    this.name = 'ErrorEjecucionDeteccionPids';
  }
}

/** Recorre las mascaras Mode 01 sin depender de una pantalla de React. */
export async function ejecutarDeteccionPids(
  opciones: OpcionesEjecutarDeteccionPids,
): Promise<ResultadoEjecucionDeteccionPids> {
  const captura: CapturaParcialDeteccionPids = {
    bloques: [],
    respuestasConfiguracion: {},
    advertenciasConfiguracion: [],
  };

  try {
    let comandoActual: string | null = '0100';
    while (comandoActual) {
      asegurarDisponible(opciones);
      opciones.alProgresar?.({
        etapa: 'bloques',
        momento: 'inicio',
        comando: comandoActual,
        mensaje: `Consultando bloque ${comandoActual}.`,
      });
      const respuesta = await opciones.enviar(comandoActual);
      const bloque = interpretarBloquePids(
        comandoActual,
        respuesta.textoAscii,
      );
      captura.bloques.push(bloque);
      opciones.alProgresar?.({
        etapa: 'bloques',
        momento: 'resultado',
        comando: bloque.comando,
        mensaje: `${bloque.comando}: mascara ${bloque.mascaraHexadecimal}; ${bloque.pidsDeclarados.length} PID declarados.`,
      });
      comandoActual = bloque.siguienteComando;
    }

    const deteccion = consolidarDeteccionPids(captura.bloques);
    for (const comando of obtenerConsultasConfiguracion(
      deteccion.pidsSoportados,
    )) {
      asegurarDisponible(opciones);
      opciones.alProgresar?.({
        etapa: 'configuracion',
        momento: 'inicio',
        comando,
        mensaje: `Consultando configuracion ${comando}.`,
      });
      const respuesta = await opciones.enviar(comando);
      captura.respuestasConfiguracion[comando] = respuesta.textoAscii;
      const validacion = traducirPidMode01(comando, respuesta.textoAscii);
      if (validacion?.error) {
        captura.advertenciasConfiguracion.push(validacion.error);
      }
    }

    return {
      ...captura,
      deteccion,
      contextoMode01: {
        pidsSoportados: [...deteccion.pidsSoportados],
        respuestasConfiguracion: {
          ...captura.respuestasConfiguracion,
        },
      },
    };
  } catch (capturado) {
    const mensaje =
      capturado instanceof Error ? capturado.message : String(capturado);
    throw new ErrorEjecucionDeteccionPids(mensaje, {
      bloques: [...captura.bloques],
      respuestasConfiguracion: { ...captura.respuestasConfiguracion },
      advertenciasConfiguracion: [...captura.advertenciasConfiguracion],
    });
  }
}

function asegurarDisponible(opciones: OpcionesEjecutarDeteccionPids): void {
  if (opciones.cancelado?.()) {
    throw new Error('Deteccion de PID cancelada.');
  }
  if (opciones.conectado && !opciones.conectado()) {
    throw new Error('El escaner se desconecto durante la deteccion de PID.');
  }
  if (opciones.sincronizado && !opciones.sincronizado()) {
    throw new Error(
      'Falta el prompt del comando anterior. Reconecta el escaner antes de continuar.',
    );
  }
}
