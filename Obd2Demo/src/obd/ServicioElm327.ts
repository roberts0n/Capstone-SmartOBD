import type { Subscription } from 'react-native-ble-plx';
import type { ServicioBle } from '../ble/ServicioBle';
import type {
  InformacionCaracteristicaGatt,
  MetricasRecepcionElm,
  RespuestaElm,
  TraduccionObd,
} from '../tipos/ble';
import {
  AcumuladorRespuestaObd,
  asciiABase64,
  base64ABytes,
} from './AcumuladorRespuestaObd';
import { analizarRespuestaObd } from './AnalisisRespuestaObd';
import { traducirPidMode01 } from './CatalogoPidsMode01';
import { obtenerTiempoMs } from '../utilidades/medicionTiempo';

// Solo se permite un comando pendiente. Su promesa se resuelve cuando el
// acumulador encuentra ">" o se rechaza por timeout, error BLE o cancelacion.
interface ComandoPendiente {
  resolver: (respuesta: RespuestaElm) => void;
  rechazar: (error: Error) => void;
  temporizador: ReturnType<typeof setTimeout>;
  metricasRecepcion: MetricasRecepcionElm;
}

export interface ManejadoresNotificacionElm {
  alRecibirFragmento: (textoAscii: string, bytes: number[]) => void;
  alOcurrirError: (error: Error) => void;
}

/**
 * Implementa el protocolo de texto ELM327 sobre un transporte BLE ya conectado.
 *
 * ServicioBle se ocupa de GATT. Esta clase se ocupa de ASCII, retorno de carro,
 * fragmentos de respuesta, prompt final y espera de un comando a la vez.
 */
export class ServicioElm327 {
  private suscripcionNotificacion: Subscription | null = null;
  private readonly acumuladorRespuesta = new AcumuladorRespuestaObd();
  private comandoPendiente: ComandoPendiente | null = null;

  constructor(private readonly servicioBle: ServicioBle) {}

  /**
   * Activa RX sobre la caracteristica elegida por el usuario.
   * Cada fragmento se informa a la consola y tambien se agrega al acumulador.
   */
  suscribirse(
    idDispositivo: string,
    caracteristica: InformacionCaracteristicaGatt,
    manejadores: ManejadoresNotificacionElm,
  ): void {
    this.cancelarSuscripcion();
    this.suscripcionNotificacion = this.servicioBle.monitorear(
      idDispositivo,
      caracteristica,
      (error, valorBase64) => {
        if (error) {
          const errorNotificacion = new Error(error.message);
          manejadores.alOcurrirError(errorNotificacion);
          this.rechazarPendiente(errorNotificacion);
          return;
        }
        if (!valorBase64) {
          return;
        }
        try {
          // Se decodifica aqui para mostrar inmediatamente cada fragmento.
          const bytes = base64ABytes(valorBase64);
          const textoAscii = String.fromCharCode(...bytes);
          const pendienteActual = this.comandoPendiente;
          if (pendienteActual) {
            pendienteActual.metricasRecepcion.primerFragmentoMs ??=
              obtenerTiempoMs();
            pendienteActual.metricasRecepcion.cantidadFragmentos += 1;
            pendienteActual.metricasRecepcion.cantidadBytes += bytes.length;
          }
          manejadores.alRecibirFragmento(textoAscii, bytes);
          this.acumuladorRespuesta.agregarBase64(valorBase64);
          // La promesa del comando no termina hasta recibir el prompt completo.
          if (
            this.comandoPendiente &&
            this.acumuladorRespuesta.estaCompleta()
          ) {
            const pendiente = this.comandoPendiente;
            pendiente.metricasRecepcion.respuestaCompletaMs = obtenerTiempoMs();
            const respuestaAcumulada = this.acumuladorRespuesta.consumir();
            const respuesta: RespuestaElm = {
              ...respuestaAcumulada,
              metricasRecepcion: pendiente.metricasRecepcion,
            };
            this.comandoPendiente = null;
            clearTimeout(pendiente.temporizador);
            pendiente.resolver(respuesta);
          }
        } catch (capturado) {
          const errorDecodificacion = convertirAError(capturado);
          manejadores.alOcurrirError(errorDecodificacion);
          this.rechazarPendiente(errorDecodificacion);
        }
      },
    );
  }

  /** Permite a la pantalla comprobar si RX esta preparado. */
  estaSuscrito(): boolean {
    return this.suscripcionNotificacion !== null;
  }

  /**
   * Envia un comando y espera su respuesta completa.
   * El comando se normaliza, se agrega "\r" y luego se codifica como Base64.
   */
  async enviarComando(
    idDispositivo: string,
    caracteristicaEscritura: InformacionCaracteristicaGatt,
    comando: string,
    tiempoEsperaMs = 10000,
  ): Promise<RespuestaElm> {
    if (!this.suscripcionNotificacion) {
      throw new Error(
        'Suscríbete a la característica de notificación primero.',
      );
    }
    if (this.comandoPendiente) {
      throw new Error('Ya existe un comando ELM327 pendiente.');
    }

    const comandoNormalizado = comando.trim().toUpperCase();
    this.acumuladorRespuesta.reiniciar();
    const metricasRecepcion: MetricasRecepcionElm = {
      inicioComandoMs: obtenerTiempoMs(),
      escrituraBleCompletaMs: null,
      primerFragmentoMs: null,
      respuestaCompletaMs: null,
      cantidadFragmentos: 0,
      cantidadBytes: 0,
    };
    // El timeout evita dejar la interfaz bloqueada si el canal RX es incorrecto
    // o si el adaptador deja de responder.
    const promesaRespuesta = new Promise<RespuestaElm>((resolver, rechazar) => {
      const temporizador = setTimeout(() => {
        this.comandoPendiente = null;
        rechazar(
          new Error(
            `Tiempo agotado esperando el prompt > para ${comandoNormalizado}.`,
          ),
        );
      }, tiempoEsperaMs);
      this.comandoPendiente = {
        resolver,
        rechazar,
        temporizador,
        metricasRecepcion,
      };
    });

    try {
      await this.servicioBle.escribir(
        idDispositivo,
        caracteristicaEscritura,
        asciiABase64(`${comandoNormalizado}\r`),
      );
      metricasRecepcion.escrituraBleCompletaMs = obtenerTiempoMs();
    } catch (capturado) {
      this.rechazarPendiente(convertirAError(capturado));
      throw capturado;
    }
    return promesaRespuesta;
  }

  /** Cancela RX y cualquier comando que aun este esperando una respuesta. */
  cancelarSuscripcion(): void {
    this.suscripcionNotificacion?.remove();
    this.suscripcionNotificacion = null;
    this.acumuladorRespuesta.reiniciar();
    this.rechazarPendiente(new Error('Suscripción ELM327 cancelada.'));
  }

  private rechazarPendiente(error: Error): void {
    if (!this.comandoPendiente) {
      return;
    }
    const pendiente = this.comandoPendiente;
    this.comandoPendiente = null;
    clearTimeout(pendiente.temporizador);
    pendiente.rechazar(error);
  }
}

/** Traduce comandos OBD sin reemplazar la respuesta cruda del resultado. */
export function traducirRespuestaObd(
  comando: string,
  respuestaCruda: string,
): TraduccionObd {
  const comandoNormalizado = comando.trim().toUpperCase();

  if (comandoNormalizado === '03') {
    const analisis = analizarRespuestaObd(comandoNormalizado, respuestaCruda);
    const tieneRespuestaDtcValida = analisis.lineas.some(
      linea =>
        linea.tipo === 'respuesta-dtc' && linea.advertencias.length === 0,
    );

    if (analisis.codigosDtc.length > 0 || tieneRespuestaDtcValida) {
      return { valor: analisis.codigosDtc, unidad: 'DTC', error: null };
    }

    return crearErrorTraduccion(
      analisis.advertencias.join(' ') ||
        'No se encontró una respuesta DTC válida con cabecera 43.',
    );
  }

  const traduccionPid = traducirPidMode01(comandoNormalizado, respuestaCruda);
  if (traduccionPid) {
    return traduccionPid;
  }

  return { valor: respuestaCruda.trim(), unidad: null, error: null };
}

function crearErrorTraduccion(mensaje: string): TraduccionObd {
  return { valor: null, unidad: null, error: mensaje };
}

function convertirAError(valor: unknown): Error {
  return valor instanceof Error ? valor : new Error(String(valor));
}
