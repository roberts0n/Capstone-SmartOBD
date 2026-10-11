import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { SesionEscanerObd } from '../escaner/TiposSesionEscaner';
import type { ContextoLecturaMode01 } from './CatalogoPidsMode01';
import { obtenerConsultasConfiguracion } from './CatalogoPidsMode01';
import {
  crearCapturaConsultaPid,
  muestrearPid,
  type CapturaConsultaPid,
  type InformeMuestreoPid,
  type MuestraPid,
} from './MuestreoPids';
import { version as versionAplicacion } from '../../package.json';
import { obtenerTiempoMs } from '../utilidades/medicionTiempo';

interface VistaMuestreo {
  comando: string | null;
  estado: 'listo' | 'leyendo' | 'deteniendo' | 'detenido' | 'error';
  muestras: MuestraPid[];
  lecturasValidas: number;
  error: string | null;
  mensaje: string | null;
  informe: InformeMuestreoPid | null;
}
const VISTA_INICIAL: VistaMuestreo = {
  comando: null,
  estado: 'listo',
  muestras: [],
  lecturasValidas: 0,
  error: null,
  mensaje: null,
  informe: null,
};

export function useMuestreoPids(sesion: SesionEscanerObd) {
  const [vista, establecerVista] = useState<VistaMuestreo>(VISTA_INICIAL);
  const montado = useRef(true);
  const control = useRef<{
    abortar: AbortController;
    motivo: string | null;
    version: number;
  } | null>(null);
  const estadoApp = useRef(AppState.currentState);

  const detener = useCallback((motivo = 'Lectura detenida.') => {
    if (!control.current || control.current.abortar.signal.aborted) return;
    control.current.motivo = motivo;
    control.current.abortar.abort();
    if (montado.current)
      establecerVista(anterior => ({
        ...anterior,
        estado: 'deteniendo',
        mensaje: 'Deteniendo al finalizar el comando actual…',
      }));
  }, []);

  useEffect(() => {
    montado.current = true;
    const suscripcion = AppState.addEventListener('change', estado => {
      estadoApp.current = estado;
      if (estado !== 'active') detener('Lectura detenida al salir de la app.');
    });
    return () => {
      montado.current = false;
      control.current?.abortar.abort();
      suscripcion.remove();
    };
  }, [detener]);

  async function iniciar(
    comando: string,
    contexto: ContextoLecturaMode01,
    alPrepararContexto?: (actualizado: ContextoLecturaMode01) => void,
  ): Promise<void> {
    if (control.current) return;
    if (
      estadoApp.current === 'background' ||
      estadoApp.current === 'inactive'
    ) {
      establecerVista(anterior => ({
        ...anterior,
        estado: 'error',
        error: 'Vuelve a la app antes de iniciar la lectura.',
      }));
      return;
    }
    const siguiente = {
      abortar: new AbortController(),
      motivo: null as string | null,
      version: sesion.obtenerVersionConexion(),
    };
    control.current = siguiente;
    const inicioPreparacion = obtenerTiempoMs();
    const contextoPreparado: ContextoLecturaMode01 = {
      pidsSoportados: [...contexto.pidsSoportados],
      respuestasConfiguracion: { ...contexto.respuestasConfiguracion },
    };
    establecerVista({
      ...VISTA_INICIAL,
      comando,
      estado: 'leyendo',
      informe: {
        versionEsquema: 1,
        versionAplicacion,
        inicio: new Date().toISOString(),
        fin: null,
        comando,
        estado: 'en-curso',
        error: null,
        mensaje: null,
        dispositivo: sesion.dispositivoConectado
          ? {
              id: sesion.dispositivoConectado.id,
              nombre:
                sesion.dispositivoConectado.nombre ??
                sesion.dispositivoConectado.nombreLocal,
            }
          : null,
        canales: {
          escritura: sesion.escrituraSeleccionada
            ? { ...sesion.escrituraSeleccionada }
            : null,
          notificacion: sesion.notificacionSeleccionada
            ? { ...sesion.notificacionSeleccionada }
            : null,
        },
        contexto: contextoPreparado,
        cabecerasConfirmadas: false,
        intervaloObjetivoMs: 500,
        cantidadConsultas: 0,
        limiteCapturas: 20,
        capturas: [],
      },
    });
    const guardarCaptura = (captura: CapturaConsultaPid) => {
      if (!montado.current || control.current !== siguiente) return;
      establecerVista(anterior => ({
        ...anterior,
        informe: anterior.informe
          ? {
              ...anterior.informe,
              cantidadConsultas: anterior.informe.cantidadConsultas + 1,
              // conservo las ultimas consultas y siempre queda incluida la que fallo
              capturas: [...anterior.informe.capturas, captura].slice(
                -anterior.informe.limiteCapturas,
              ),
            }
          : null,
      }));
    };
    const comprobarSesion = () => {
      if (
        siguiente.version !== sesion.obtenerVersionConexion() ||
        !sesion.conectado() ||
        !sesion.estaPreparado()
      )
        throw new Error(
          'La conexión del escáner cambió. La lectura se detuvo.',
        );
      if (!sesion.estaSincronizado())
        throw new Error(
          'Falta la respuesta del comando anterior. Reconecta el escáner.',
        );
    };
    const preparar = async (consulta: string) => {
      comprobarSesion();
      let respuesta;
      try {
        respuesta = await sesion.enviarComando(consulta);
      } catch (capturado) {
        guardarCaptura(
          crearCapturaConsultaPid(
            consulta,
            null,
            obtenerTiempoMs() - inicioPreparacion,
            capturado instanceof Error ? capturado.message : String(capturado),
            'preparacion',
          ),
        );
        throw capturado;
      }
      guardarCaptura(
        crearCapturaConsultaPid(
          consulta,
          respuesta,
          obtenerTiempoMs() - inicioPreparacion,
          null,
          'preparacion',
        ),
      );
      comprobarSesion();
      return respuesta;
    };
    try {
      if (!sesion.estaPreparado())
        throw new Error(
          'Verifica el escáner con ATI antes de iniciar la lectura.',
        );
      if (!sesion.estaSuscrito() && !sesion.activarSuscripcion())
        throw new Error('No se pudo activar la recepción del escáner.');
      if (siguiente.abortar.signal.aborted) return;
      const cabeceras = await preparar('ATH1');
      const aceptado = cabeceras.textoAscii
        .replace(/>/g, '')
        .split(/[\r\n]+/)
        .some(linea => linea.trim().toUpperCase() === 'OK');
      if (!aceptado)
        throw new Error(
          'El escáner no confirmó ATH1. Guarda la captura técnica.',
        );
      // dejo las cabeceras visibles; no invento cual era el ajuste previo del adaptador
      contextoPreparado.respuestasConfiguracion = {};
      alPrepararContexto?.(contextoPreparado);
      establecerVista(anterior => ({
        ...anterior,
        informe: anterior.informe
          ? {
              ...anterior.informe,
              cabecerasConfirmadas: true,
              contexto: { ...contextoPreparado, respuestasConfiguracion: {} },
            }
          : null,
      }));
      if (siguiente.abortar.signal.aborted) return;
      // las escalas tambien necesitan cabeceras para seguir asociadas a su ecu
      for (const consulta of obtenerConsultasConfiguracion(
        contextoPreparado.pidsSoportados,
      )) {
        if (siguiente.abortar.signal.aborted) return;
        const respuestaConfiguracion = await preparar(consulta);
        if (siguiente.abortar.signal.aborted) return;
        contextoPreparado.respuestasConfiguracion = {
          ...contextoPreparado.respuestasConfiguracion,
          [consulta]: respuestaConfiguracion.textoAscii,
        };
        alPrepararContexto?.({ ...contextoPreparado });
        establecerVista(anterior => ({
          ...anterior,
          informe: anterior.informe
            ? {
                ...anterior.informe,
                contexto: { ...contextoPreparado },
              }
            : null,
        }));
      }
      await muestrearPid({
        comando,
        contexto: contextoPreparado,
        enviar: pid => sesion.enviarComando(pid),
        conectado: () =>
          siguiente.version === sesion.obtenerVersionConexion() &&
          sesion.conectado() &&
          sesion.estaPreparado(),
        sincronizado: sesion.estaSincronizado,
        signal: siguiente.abortar.signal,
        alCaptura: captura =>
          guardarCaptura({
            ...captura,
            tiempoTranscurridoMs: obtenerTiempoMs() - inicioPreparacion,
          }),
        alMuestra: muestra => {
          if (
            !montado.current ||
            control.current !== siguiente ||
            siguiente.abortar.signal.aborted
          )
            return;
          establecerVista(anterior => ({
            ...anterior,
            // conservo un minuto reciente y un tope de puntos, no una grabacion ilimitada
            muestras: [
              ...anterior.muestras.filter(
                item =>
                  item.tiempoTranscurridoMs >=
                  muestra.tiempoTranscurridoMs - 60000,
              ),
              muestra,
            ].slice(-240),
            lecturasValidas:
              anterior.lecturasValidas + (muestra.valor === null ? 0 : 1),
            error: muestra.error,
          }));
        },
      });
      if (montado.current && control.current === siguiente)
        establecerVista(anterior => ({
          ...anterior,
          estado: 'detenido',
          mensaje: siguiente.motivo ?? 'Lectura detenida.',
        }));
    } catch (capturado) {
      if (montado.current && control.current === siguiente)
        establecerVista(anterior => ({
          ...anterior,
          estado: siguiente.abortar.signal.aborted ? 'detenido' : 'error',
          error: siguiente.abortar.signal.aborted
            ? anterior.error
            : capturado instanceof Error
            ? capturado.message
            : 'No se pudo continuar la lectura.',
          mensaje: siguiente.motivo,
        }));
    } finally {
      if (montado.current && control.current === siguiente)
        establecerVista(anterior => ({
          ...anterior,
          estado: anterior.estado === 'error' ? 'error' : 'detenido',
          mensaje: siguiente.motivo ?? anterior.mensaje,
          informe: anterior.informe
            ? {
                ...anterior.informe,
                fin: new Date().toISOString(),
                estado: anterior.estado === 'error' ? 'error' : 'detenido',
                error: anterior.error,
                mensaje: siguiente.motivo ?? anterior.mensaje,
              }
            : null,
        }));
      if (control.current === siguiente) control.current = null;
    }
  }

  function limpiar() {
    if (!control.current)
      establecerVista(anterior => ({
        ...VISTA_INICIAL,
        informe: anterior.informe,
      }));
  }

  const muestrasValidas = vista.muestras.filter(item => item.valor !== null);
  const primera = muestrasValidas[0];
  const ultima = muestrasValidas[muestrasValidas.length - 1];
  const duracion =
    ultima && primera
      ? ultima.tiempoTranscurridoMs - primera.tiempoTranscurridoMs
      : 0;
  return {
    ...vista,
    enCurso: vista.estado === 'leyendo' || vista.estado === 'deteniendo',
    deteniendo: vista.estado === 'deteniendo',
    frecuenciaHz:
      duracion > 0 ? ((muestrasValidas.length - 1) * 1000) / duracion : null,
    iniciar,
    detener,
    limpiar,
  };
}
