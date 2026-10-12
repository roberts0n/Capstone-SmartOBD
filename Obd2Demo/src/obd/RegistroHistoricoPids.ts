import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  obtenerConsultasConfiguracion,
  obtenerMedicionGraficaPid,
  type ContextoLecturaMode01,
} from './CatalogoPidsMode01';
import {
  crearCapturaConsultaPid,
  esMedicionValida,
  esperarMuestreo,
  interpretarMedicionPid,
  type CapturaConsultaPid,
  type MuestraPid,
  type SeleccionOrigenPid,
} from './MuestreoPids';
import type { RespuestaElm } from '../tipos/ble';
import type { SesionEscanerObd } from '../escaner/TiposSesionEscaner';
import { mantenerPantallaRegistro } from '../informes/guardarInformeDtc';
import { obtenerTiempoMs } from '../utilidades/medicionTiempo';
import { version as versionAplicacion } from '../../package.json';

export const DURACIONES_REGISTRO_MS = [60000, 300000, 600000] as const;

export interface SerieHistoricaPid {
  comando: string;
  nombre: string;
  unidad: string;
  campo?: string | null;
  seleccionOrigen: SeleccionOrigenPid | null;
  muestras: MuestraPid[];
  error: string | null;
  estado: 'disponible' | 'sin-lectura';
}

export interface RegistroHistoricoPids {
  versionEsquema: 1;
  tipo: 'registro-historico-pids';
  versionAplicacion: string;
  inicio: string | null;
  fin: string | null;
  duracionSolicitadaMs: number;
  duracionRealMs: number;
  periodoRondaObjetivoMs: number;
  estado: 'completo' | 'parcial';
  motivoFin: string;
  error: string | null;
  dispositivo: { id: string; nombre: string | null } | null;
  contexto: ContextoLecturaMode01;
  series: SerieHistoricaPid[];
  cantidadConsultas: number;
  limiteCapturas: number;
  capturasTecnicas: CapturaConsultaPid[];
}

export function validarRegistroPids(
  comandos: readonly string[],
  duracionMs: number,
  contexto: ContextoLecturaMode01,
): void {
  if (!Number.isFinite(duracionMs) || duracionMs < 1000 || duracionMs > 600000)
    throw new Error('La duración del registro debe ser de hasta diez minutos.');
  if (
    comandos.length < 1 ||
    comandos.length > 3 ||
    new Set(comandos).size !== comandos.length
  )
    throw new Error('Selecciona entre uno y tres PID distintos.');
  for (const comando of comandos) {
    if (
      !obtenerMedicionGraficaPid(comando) ||
      !contexto.pidsSoportados.includes(comando)
    )
      throw new Error(
        `El PID ${comando} no está disponible para este registro.`,
      );
  }
}

export function frecuenciaSeriePid(serie: SerieHistoricaPid): number | null {
  const validas = serie.muestras.filter(muestra => muestra.valor !== null);
  if (validas.length < 2) return null;
  const intervalo =
    validas[validas.length - 1].tiempoTranscurridoMs -
    validas[0].tiempoTranscurridoMs;
  return intervalo > 0 ? ((validas.length - 1) * 1000) / intervalo : null;
}

export function nombreRegistroPids(registro: RegistroHistoricoPids): string {
  return `SmartOBD_Registro_PIDs_${(
    registro.inicio ??
    registro.fin ??
    'sin-inicio'
  ).replace(/[:.]/g, '-')}.json`;
}

interface OpcionesRegistro {
  comandos: readonly string[];
  duracionMs: number;
  contexto: ContextoLecturaMode01;
  enviar: (comando: string) => Promise<RespuestaElm>;
  comprobarConexion: () => void;
  signal: AbortSignal;
  alCaptura: (captura: CapturaConsultaPid) => void;
  alComenzar: (inicioMs: number) => void;
  alSeries?: (series: SerieHistoricaPid[]) => void;
  reloj?: () => number;
}

// hago una ronda a la vez; no preparo una cola de comandos que quede atrasada
export async function registrarPids(
  opciones: OpcionesRegistro,
): Promise<{ series: SerieHistoricaPid[]; duracionRealMs: number }> {
  validarRegistroPids(
    opciones.comandos,
    opciones.duracionMs,
    opciones.contexto,
  );
  const reloj = opciones.reloj ?? obtenerTiempoMs;
  const series = opciones.comandos.map(comando => {
    const medicion = obtenerMedicionGraficaPid(comando)!;
    return {
      comando,
      nombre: medicion.nombre,
      campo: medicion.campo,
      unidad: medicion.unidad,
      seleccionOrigen: null,
      muestras: [],
      error: null,
      estado: 'disponible',
    } as SerieHistoricaPid;
  });
  const fallos = new Map(series.map(serie => [serie.comando, 0]));
  const inicio = reloj();
  opciones.alComenzar(inicio);
  // entrego las mismas series al comenzar para conservar tambien un registro interrumpido
  opciones.alSeries?.(series);
  while (!opciones.signal.aborted && reloj() - inicio < opciones.duracionMs) {
    const inicioRonda = reloj();
    for (const serie of series) {
      if (opciones.signal.aborted || reloj() - inicio >= opciones.duracionMs)
        break;
      if (serie.estado === 'sin-lectura') continue;
      opciones.comprobarConexion();
      let respuesta: RespuestaElm;
      try {
        respuesta = await opciones.enviar(serie.comando);
      } catch (capturado) {
        const error =
          capturado instanceof Error
            ? capturado.message
            : 'Falló la comunicación con el escáner.';
        opciones.alCaptura(
          crearCapturaConsultaPid(serie.comando, null, reloj() - inicio, error),
        );
        if (opciones.signal.aborted) break;
        serie.muestras.push({
          comando: serie.comando,
          tiempoTranscurridoMs: reloj() - inicio,
          valor: null,
          unidad: serie.unidad,
          error,
        });
        serie.error = error;
        // un fallo de transporte puede dejar una respuesta tardia; no envio otro comando
        throw new Error(error);
      }
      const transcurrido = reloj() - inicio;
      if (opciones.signal.aborted) {
        opciones.alCaptura(
          crearCapturaConsultaPid(
            serie.comando,
            respuesta,
            transcurrido,
            'Respuesta descartada: el registro ya estaba detenido.',
          ),
        );
        break;
      }
      try {
        opciones.comprobarConexion();
      } catch (capturado) {
        opciones.alCaptura(
          crearCapturaConsultaPid(
            serie.comando,
            respuesta,
            transcurrido,
            capturado instanceof Error ? capturado.message : String(capturado),
          ),
        );
        throw capturado;
      }
      let valor: number | null = null;
      let error: string | null = null;
      try {
        const lectura = interpretarMedicionPid(
          serie.comando,
          respuesta.textoAscii,
          opciones.contexto,
          serie.seleccionOrigen,
        );
        if (esMedicionValida(lectura.traduccion)) {
          valor = lectura.traduccion!.valor as number;
          serie.seleccionOrigen = lectura.seleccion;
        } else
          error =
            lectura.traduccion?.error ?? 'No se recibió una medición válida.';
      } catch (capturado) {
        error =
          capturado instanceof Error ? capturado.message : String(capturado);
      }
      opciones.alCaptura(
        crearCapturaConsultaPid(serie.comando, respuesta, transcurrido, error),
      );
      serie.muestras.push({
        comando: serie.comando,
        tiempoTranscurridoMs: transcurrido,
        valor,
        unidad: serie.unidad,
        error,
      });
      serie.error = error;
      const cantidadFallos = error ? fallos.get(serie.comando)! + 1 : 0;
      fallos.set(serie.comando, cantidadFallos);
      if (cantidadFallos >= 3) serie.estado = 'sin-lectura';
    }
    if (series.every(serie => serie.estado === 'sin-lectura'))
      throw new Error(
        'Ninguno de los PID seleccionados pudo seguir entregando mediciones.',
      );
    await esperarMuestreo(
      Math.max(
        0,
        Math.min(
          1000 - (reloj() - inicioRonda),
          opciones.duracionMs - (reloj() - inicio),
        ),
      ),
      opciones.signal,
    );
  }
  return { series, duracionRealMs: Math.max(0, reloj() - inicio) };
}

interface VistaRegistro {
  estado: 'listo' | 'preparando' | 'registrando' | 'deteniendo' | 'terminado';
  restanteMs: number;
  registro: RegistroHistoricoPids | null;
  error: string | null;
}

export function useRegistroHistoricoPids(sesion: SesionEscanerObd) {
  const [vista, establecerVista] = useState<VistaRegistro>({
    estado: 'listo',
    restanteMs: 0,
    registro: null,
    error: null,
  });
  const control = useRef<{
    abortar: AbortController;
    motivo: string;
    inicioMs: number | null;
  } | null>(null);
  const montado = useRef(true);
  const estadoApp = useRef(AppState.currentState);
  const detener = useCallback((motivo = 'Detenido por el usuario.') => {
    const actual = control.current;
    if (!actual || actual.abortar.signal.aborted) return;
    actual.motivo = motivo;
    actual.abortar.abort();
    if (montado.current)
      establecerVista(anterior => ({ ...anterior, estado: 'deteniendo' }));
  }, []);
  useEffect(() => {
    montado.current = true;
    const suscripcion = AppState.addEventListener('change', estado => {
      estadoApp.current = estado;
      if (estado !== 'active')
        detener('Registro interrumpido al salir de la app.');
    });
    return () => {
      montado.current = false;
      if (control.current) {
        control.current.motivo = 'Registro interrumpido al cerrar la pantalla.';
        control.current.abortar.abort();
      }
      suscripcion.remove();
    };
  }, [detener]);

  async function iniciar(
    comandos: readonly string[],
    duracionMs: number,
    entrada: ContextoLecturaMode01,
    alPreparar?: (contexto: ContextoLecturaMode01) => void,
  ): Promise<void> {
    if (control.current) return;
    if (
      estadoApp.current === 'background' ||
      estadoApp.current === 'inactive'
    ) {
      establecerVista(anterior => ({
        ...anterior,
        error: 'Vuelve a la app antes de registrar.',
      }));
      return;
    }
    try {
      validarRegistroPids(comandos, duracionMs, entrada);
    } catch (error) {
      establecerVista(anterior => ({
        ...anterior,
        error:
          error instanceof Error
            ? error.message
            : 'Revisa la configuración del registro.',
      }));
      return;
    }
    const actual = {
      abortar: new AbortController(),
      motivo: 'Duración cumplida.',
      inicioMs: null as number | null,
    };
    control.current = actual;
    const version = sesion.obtenerVersionConexion();
    const contexto: ContextoLecturaMode01 = {
      pidsSoportados: [...entrada.pidsSoportados],
      respuestasConfiguracion: {},
    };
    const registro: RegistroHistoricoPids = {
      versionEsquema: 1,
      tipo: 'registro-historico-pids',
      versionAplicacion,
      inicio: null,
      fin: null,
      duracionSolicitadaMs: duracionMs,
      duracionRealMs: 0,
      periodoRondaObjetivoMs: 1000,
      estado: 'parcial',
      motivoFin: actual.motivo,
      error: null,
      dispositivo: sesion.dispositivoConectado
        ? {
            id: sesion.dispositivoConectado.id,
            nombre:
              sesion.dispositivoConectado.nombre ??
              sesion.dispositivoConectado.nombreLocal,
          }
        : null,
      contexto,
      series: [],
      cantidadConsultas: 0,
      limiteCapturas: 20,
      capturasTecnicas: [],
    };
    establecerVista({
      estado: 'preparando',
      restanteMs: duracionMs,
      registro: null,
      error: null,
    });
    let pantallaSolicitada = false;
    let progreso: ReturnType<typeof setInterval> | null = null;
    const comprobar = () => {
      if (
        version !== sesion.obtenerVersionConexion() ||
        !sesion.conectado() ||
        !sesion.estaPreparado()
      )
        throw new Error(
          'La conexión del escáner cambió. El registro se interrumpió.',
        );
      if (!sesion.estaSincronizado())
        throw new Error(
          'Falta la respuesta del comando anterior. Reconecta el escáner.',
        );
    };
    const capturar = (captura: CapturaConsultaPid) => {
      registro.cantidadConsultas += 1;
      registro.capturasTecnicas.push(captura);
      if (registro.capturasTecnicas.length > registro.limiteCapturas)
        registro.capturasTecnicas.shift();
    };
    const inicioPreparacion = obtenerTiempoMs();
    const preparar = async (comando: string) => {
      comprobar();
      let respuesta: RespuestaElm;
      try {
        respuesta = await sesion.enviarComando(comando);
      } catch (error) {
        capturar(
          crearCapturaConsultaPid(
            comando,
            null,
            obtenerTiempoMs() - inicioPreparacion,
            error instanceof Error ? error.message : String(error),
            'preparacion',
          ),
        );
        throw error;
      }
      capturar(
        crearCapturaConsultaPid(
          comando,
          respuesta,
          obtenerTiempoMs() - inicioPreparacion,
          null,
          'preparacion',
        ),
      );
      comprobar();
      return respuesta;
    };
    try {
      comprobar();
      await mantenerPantallaRegistro(true);
      pantallaSolicitada = true;
      if (actual.abortar.signal.aborted) return;
      if (!sesion.estaSuscrito() && !sesion.activarSuscripcion())
        throw new Error('No se pudo activar la recepción del escáner.');
      const cabeceras = await preparar('ATH1');
      if (
        !cabeceras.textoAscii
          .replace(/>/g, '')
          .split(/[\r\n]+/)
          .some(linea => linea.trim().toUpperCase() === 'OK')
      )
        throw new Error('El escáner no confirmó ATH1.');
      for (const consulta of obtenerConsultasConfiguracion(
        contexto.pidsSoportados,
      )) {
        if (actual.abortar.signal.aborted) return;
        const respuesta = await preparar(consulta);
        contexto.respuestasConfiguracion = {
          ...contexto.respuestasConfiguracion,
          [consulta]: respuesta.textoAscii,
        };
      }
      alPreparar?.(contexto);
      if (actual.abortar.signal.aborted) return;
      const resultado = await registrarPids({
        comandos,
        duracionMs,
        contexto,
        enviar: comando => sesion.enviarComando(comando),
        comprobarConexion: comprobar,
        signal: actual.abortar.signal,
        alCaptura: capturar,
        alSeries: series => {
          registro.series = series;
        },
        alComenzar: inicio => {
          actual.inicioMs = inicio;
          registro.inicio = new Date().toISOString();
          if (montado.current)
            establecerVista(anterior => ({
              ...anterior,
              estado: 'registrando',
            }));
          progreso = setInterval(() => {
            if (montado.current && !actual.abortar.signal.aborted)
              establecerVista(anterior => ({
                ...anterior,
                restanteMs: Math.max(
                  0,
                  duracionMs - (obtenerTiempoMs() - inicio),
                ),
              }));
          }, 1000);
        },
      });
      registro.series = resultado.series;
    } catch (error) {
      if (!actual.abortar.signal.aborted) {
        registro.error = error instanceof Error ? error.message : String(error);
        actual.motivo = 'Registro interrumpido por un error.';
      }
    } finally {
      if (progreso !== null) clearInterval(progreso);
      registro.duracionRealMs =
        actual.inicioMs === null
          ? 0
          : Math.max(0, obtenerTiempoMs() - actual.inicioMs);
      registro.fin = new Date().toISOString();
      registro.estado =
        !registro.error &&
        !actual.abortar.signal.aborted &&
        actual.inicioMs !== null &&
        registro.series.every(
          serie =>
            serie.estado === 'disponible' &&
            serie.muestras.some(muestra => muestra.valor !== null),
        )
          ? 'completo'
          : 'parcial';
      registro.motivoFin = actual.motivo;
      if (
        registro.estado === 'parcial' &&
        !registro.error &&
        !actual.abortar.signal.aborted
      )
        registro.motivoFin = 'Duración cumplida con PID sin lectura.';
      if (pantallaSolicitada) {
        try {
          await mantenerPantallaRegistro(false);
        } catch {
          registro.error =
            registro.error ??
            'No se pudo liberar la pantalla. Cierra la app al terminar.';
          registro.estado = 'parcial';
        }
      }
      if (montado.current)
        establecerVista({
          estado: 'terminado',
          restanteMs: Math.max(0, duracionMs - registro.duracionRealMs),
          registro,
          error: registro.error,
        });
      if (control.current === actual) control.current = null;
    }
  }
  return {
    ...vista,
    enCurso:
      vista.estado === 'preparando' ||
      vista.estado === 'registrando' ||
      vista.estado === 'deteniendo',
    detener,
    iniciar,
  };
}
