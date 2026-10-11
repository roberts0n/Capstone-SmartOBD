import {
  obtenerDefinicionPidMode01,
  traducirPidMode01,
  type ContextoLecturaMode01,
} from './CatalogoPidsMode01';
import { extraerRespuestasPid } from './mode01/ExtraerRespuestaPid';
import type { InformacionCaracteristicaGatt, RespuestaElm } from '../tipos/ble';
import { obtenerTiempoMs } from '../utilidades/medicionTiempo';

// parto con estas cuatro mediciones, sin asumir que todos los autos las entregan
export const PIDS_GRAFICABLES_INICIALES = [
  '010C',
  '0104',
  '010B',
  '0105',
] as const;

export interface MuestraPid {
  comando: string;
  tiempoTranscurridoMs: number;
  valor: number | null;
  unidad: string;
  error: string | null;
}

export interface CapturaConsultaPid {
  fecha: string;
  comando: string;
  fase: 'preparacion' | 'lectura';
  tiempoTranscurridoMs: number;
  respuestaCruda: string | null;
  metricasRecepcion: RespuestaElm['metricasRecepcion'] | null;
  respuestasDetectadas: {
    cabecera: string | null;
    datosHexadecimales: string;
  }[];
  error: string | null;
}

export interface InformeMuestreoPid {
  versionEsquema: 1;
  versionAplicacion: string;
  inicio: string;
  fin: string | null;
  comando: string;
  estado: 'en-curso' | 'detenido' | 'error';
  error: string | null;
  mensaje: string | null;
  dispositivo: { id: string; nombre: string | null } | null;
  canales: {
    escritura: InformacionCaracteristicaGatt | null;
    notificacion: InformacionCaracteristicaGatt | null;
  };
  contexto: ContextoLecturaMode01;
  cabecerasConfirmadas: boolean;
  intervaloObjetivoMs: number;
  cantidadConsultas: number;
  limiteCapturas: number;
  capturas: CapturaConsultaPid[];
}

// guardo el texto tal como llego, incluso cuando no puedo dibujar una medicion
export function crearCapturaConsultaPid(
  comando: string,
  respuesta: RespuestaElm | null,
  tiempoTranscurridoMs: number,
  error: string | null = null,
  fase: CapturaConsultaPid['fase'] = 'lectura',
): CapturaConsultaPid {
  const respuestas =
    respuesta && /^01[0-9A-F]{2}$/i.test(comando)
      ? extraerRespuestasPid(
          respuesta.textoAscii,
          Number.parseInt(comando.slice(2), 16),
        )
      : [];
  return {
    fecha: new Date().toISOString(),
    comando,
    fase,
    tiempoTranscurridoMs,
    respuestaCruda: respuesta?.textoAscii ?? null,
    metricasRecepcion: respuesta?.metricasRecepcion ?? null,
    respuestasDetectadas: respuestas.map(item => ({
      cabecera: item.cabecera,
      datosHexadecimales: item.datos
        .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(' '),
    })),
    error,
  };
}

export function nombreInformeMuestreo(informe: InformeMuestreoPid): string {
  return `SmartOBD_PID_${informe.comando}_${informe.inicio.replace(
    /[:.]/g,
    '-',
  )}.json`;
}

export interface OpcionesMuestreoPid {
  comando: string;
  contexto: ContextoLecturaMode01;
  enviar: (comando: string) => Promise<RespuestaElm>;
  conectado: () => boolean;
  sincronizado: () => boolean;
  signal: AbortSignal;
  alMuestra: (muestra: MuestraPid) => void;
  alCaptura?: (captura: CapturaConsultaPid) => void;
  intervaloMs?: number;
  reloj?: () => number;
}

export async function muestrearPid(
  opciones: OpcionesMuestreoPid,
): Promise<void> {
  const comando = opciones.comando.trim().toUpperCase();
  const definicion = obtenerDefinicionPidMode01(comando);
  if (!PIDS_GRAFICABLES_INICIALES.some(pid => pid === comando) || !definicion)
    throw new Error('Ese PID no forma parte de la selección gráfica inicial.');
  if (!opciones.contexto.pidsSoportados.includes(comando))
    throw new Error('El vehículo no declara compatible ese PID.');
  const intervalo = opciones.intervaloMs ?? 500;
  if (!Number.isFinite(intervalo) || intervalo < 100 || intervalo > 10000)
    throw new Error('El intervalo de lectura no es válido.');

  const contexto: ContextoLecturaMode01 = {
    pidsSoportados: [...opciones.contexto.pidsSoportados],
    respuestasConfiguracion: { ...opciones.contexto.respuestasConfiguracion },
  };
  const reloj = opciones.reloj ?? obtenerTiempoMs;
  const inicio = reloj();
  let fallosSeguidos = 0;
  let origen: string | null | undefined;
  const comprobarConexion = () => {
    if (!opciones.conectado())
      throw new Error('La conexión del escáner cambió. La lectura se detuvo.');
    if (!opciones.sincronizado())
      throw new Error(
        'Falta la respuesta del comando anterior. Reconecta el escáner.',
      );
  };

  while (!opciones.signal.aborted) {
    comprobarConexion();
    const inicioConsulta = reloj();
    let respuesta: RespuestaElm;
    try {
      respuesta = await opciones.enviar(comando);
    } catch (capturado) {
      const mensaje =
        capturado instanceof Error
          ? capturado.message
          : 'Falló la comunicación con el escáner.';
      opciones.alCaptura?.(
        crearCapturaConsultaPid(comando, null, reloj() - inicio, mensaje),
      );
      if (opciones.signal.aborted) return;
      comprobarConexion();
      opciones.alMuestra({
        comando,
        tiempoTranscurridoMs: reloj() - inicio,
        valor: null,
        unidad: unidadPid(comando),
        error: mensaje,
      });
      // no reintento un fallo de transporte porque puede quedar una respuesta tardia
      throw new Error(mensaje);
    }
    const recibidoEn = reloj() - inicio;
    const registrar = (error: string | null) =>
      opciones.alCaptura?.(
        crearCapturaConsultaPid(comando, respuesta, recibidoEn, error),
      );
    if (opciones.signal.aborted) {
      registrar('Respuesta descartada: la lectura ya estaba detenida.');
      return;
    }
    try {
      comprobarConexion();
    } catch (capturado) {
      registrar(
        capturado instanceof Error ? capturado.message : String(capturado),
      );
      throw capturado;
    }
    const respuestas = extraerRespuestasPid(
      respuesta.textoAscii,
      Number.parseInt(comando.slice(2), 16),
    );
    if (respuestas.length > 1) {
      const mensaje =
        'Hay varias respuestas para este PID. No se mezclan distintas ECU en una curva.';
      registrar(mensaje);
      throw new Error(mensaje);
    }
    if (
      respuestas.length === 1 &&
      origen !== undefined &&
      respuestas[0].cabecera !== origen
    ) {
      const mensaje =
        'Cambió la ECU que responde. La lectura se detuvo para no mezclar datos.';
      registrar(mensaje);
      throw new Error(mensaje);
    }
    const traduccion = traducirPidMode01(
      comando,
      respuesta.textoAscii,
      contexto,
    );
    const valido =
      !traduccion?.error &&
      typeof traduccion?.valor === 'number' &&
      Number.isFinite(traduccion.valor);
    const error = valido
      ? null
      : traduccion?.error ?? 'No se recibió una medición numérica válida.';
    registrar(error);
    if (valido) origen = respuestas[0]?.cabecera;
    opciones.alMuestra({
      comando,
      tiempoTranscurridoMs: recibidoEn,
      valor: valido ? (traduccion!.valor as number) : null,
      unidad: traduccion?.unidad ?? unidadPid(comando),
      error,
    });
    fallosSeguidos = valido ? 0 : fallosSeguidos + 1;
    if (fallosSeguidos >= 3)
      throw new Error(
        'Se detuvo la lectura tras tres respuestas consecutivas sin medición válida.',
      );
    // cuento desde el envio, pero nunca adelanto el siguiente comando a su respuesta
    await esperarMuestreo(
      Math.max(0, intervalo - (reloj() - inicioConsulta)),
      opciones.signal,
    );
  }
}

function unidadPid(comando: string): string {
  return comando === '010C'
    ? 'rpm'
    : comando === '0104'
    ? '%'
    : comando === '010B'
    ? 'kPa'
    : '°C';
}

function esperarMuestreo(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted || ms <= 0) return Promise.resolve();
  return new Promise(resolver => {
    const terminar = () => {
      clearTimeout(temporizador);
      signal.removeEventListener('abort', terminar);
      resolver();
    };
    const temporizador = setTimeout(terminar, ms);
    signal.addEventListener('abort', terminar, { once: true });
    if (signal.aborted) terminar();
  });
}
