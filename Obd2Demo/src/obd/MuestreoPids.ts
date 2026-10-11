import {
  obtenerDefinicionPidMode01,
  traducirPidMode01,
  type ContextoLecturaMode01,
} from './CatalogoPidsMode01';
import { extraerRespuestasPid } from './mode01/ExtraerRespuestaPid';
import type {
  InformacionCaracteristicaGatt,
  RespuestaElm,
  TraduccionObd,
} from '../tipos/ble';
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

export interface SeleccionOrigenPid {
  cabecera: string | null;
  origenesDetectados: (string | null)[];
  motivo: 'preferencia-7E8' | 'unico-origen-valido';
}

export interface InformeMuestreoPid {
  versionEsquema: 2;
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
  seleccionOrigen: SeleccionOrigenPid | null;
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
  alOrigen?: (seleccion: SeleccionOrigenPid) => void;
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
  let seleccion: SeleccionOrigenPid | null = null;
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
    let traduccion: TraduccionObd | null;
    try {
      if (!seleccion) {
        const inicial = elegirOrigenPid(
          comando,
          respuesta.textoAscii,
          contexto,
        );
        traduccion = inicial.traduccion;
        seleccion = inicial.seleccion;
        if (seleccion) opciones.alOrigen?.(seleccion);
      } else if (
        !respuestas.map(item => item.cabecera).includes(seleccion.cabecera)
      ) {
        traduccion = {
          valor: null,
          unidad: null,
          error:
            seleccion.cabecera === null
              ? 'No llegó una medición del origen sin cabecera seleccionado. No se sustituye por otra ECU.'
              : `No respondió la ECU ${seleccion.cabecera} al PID solicitado. No se sustituye por otra ECU.`,
        };
      } else {
        traduccion = traducirPidMode01(
          comando,
          respuesta.textoAscii,
          contexto,
          { cabecera: seleccion.cabecera },
        );
      }
    } catch (capturado) {
      registrar(
        capturado instanceof Error ? capturado.message : String(capturado),
      );
      throw capturado;
    }
    const valido = esMedicionValida(traduccion);
    const error = valido
      ? null
      : traduccion?.error ?? 'No se recibió una medición numérica válida.';
    registrar(error);
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
        'Se detuvo la lectura tras tres respuestas consecutivas sin medición válida. ' +
          error,
      );
    // cuento desde el envio, pero nunca adelanto el siguiente comando a su respuesta
    await esperarMuestreo(
      Math.max(0, intervalo - (reloj() - inicioConsulta)),
      opciones.signal,
    );
  }
}

function esMedicionValida(traduccion: TraduccionObd | null): boolean {
  return (
    !traduccion?.error &&
    typeof traduccion?.valor === 'number' &&
    Number.isFinite(traduccion.valor)
  );
}

function elegirOrigenPid(
  comando: string,
  cruda: string,
  contexto: ContextoLecturaMode01,
): { seleccion: SeleccionOrigenPid | null; traduccion: TraduccionObd | null } {
  const respuestas = extraerRespuestasPid(
    cruda,
    Number.parseInt(comando.slice(2), 16),
  );
  const origenes = [...new Set(respuestas.map(item => item.cabecera))];
  const evaluadas = origenes.map(cabecera => ({
    cabecera,
    traduccion: traducirPidMode01(comando, cruda, contexto, { cabecera }),
  }));
  const validas = evaluadas.filter(item => esMedicionValida(item.traduccion));
  // prefiero 7e8 cuando es valido, no la primera respuesta que alcanzo a llegar
  const preferida = validas.find(item => item.cabecera === '7E8');
  const elegida = preferida ?? (validas.length === 1 ? validas[0] : null);
  if (!elegida && validas.length > 1) {
    throw new Error(
      'Respondieron varias ECU válidas, pero no se pudo elegir un origen automáticamente. Esta medición no está disponible.',
    );
  }
  return {
    seleccion: elegida
      ? {
          cabecera: elegida.cabecera,
          origenesDetectados: origenes,
          motivo: preferida ? 'preferencia-7E8' : 'unico-origen-valido',
        }
      : null,
    traduccion: elegida
      ? elegida.traduccion
      : (evaluadas.find(item => item.cabecera === '7E8') ?? evaluadas[0])
          ?.traduccion ?? traducirPidMode01(comando, cruda, contexto),
  };
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
