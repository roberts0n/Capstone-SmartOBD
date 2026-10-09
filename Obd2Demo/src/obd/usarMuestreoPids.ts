import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { SesionEscanerObd } from '../escaner/TiposSesionEscaner';
import type { ContextoLecturaMode01 } from './CatalogoPidsMode01';
import { muestrearPid, type MuestraPid } from './MuestreoPids';

interface VistaMuestreo {
  comando: string | null;
  estado: 'listo' | 'leyendo' | 'deteniendo' | 'detenido' | 'error';
  muestras: MuestraPid[];
  lecturasValidas: number;
  error: string | null;
  mensaje: string | null;
}
const VISTA_INICIAL: VistaMuestreo = {
  comando: null,
  estado: 'listo',
  muestras: [],
  lecturasValidas: 0,
  error: null,
  mensaje: null,
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
    establecerVista({ ...VISTA_INICIAL, comando, estado: 'leyendo' });
    try {
      if (!sesion.estaPreparado())
        throw new Error(
          'Verifica el escáner con ATI antes de iniciar la lectura.',
        );
      if (!sesion.estaSuscrito() && !sesion.activarSuscripcion())
        throw new Error('No se pudo activar la recepción del escáner.');
      await muestrearPid({
        comando,
        contexto,
        enviar: pid => sesion.enviarComando(pid),
        conectado: () =>
          siguiente.version === sesion.obtenerVersionConexion() &&
          sesion.conectado() &&
          sesion.estaPreparado(),
        sincronizado: sesion.estaSincronizado,
        signal: siguiente.abortar.signal,
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
      if (control.current === siguiente) control.current = null;
    }
  }

  function limpiar() {
    if (!control.current) establecerVista(VISTA_INICIAL);
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
