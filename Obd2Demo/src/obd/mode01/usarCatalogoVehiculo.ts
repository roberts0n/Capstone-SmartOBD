import { useCallback, useRef, useState } from 'react';
import type { ResultadoDeteccionPids } from '../../tipos/ble';
import type { ContextoLecturaMode01 } from './TiposPid';

/** Agrupa la deteccion visible y el contexto de traduccion de una conexion. */
export function useCatalogoVehiculo() {
  const [deteccion, establecerDeteccion] =
    useState<ResultadoDeteccionPids | null>(null);
  const contexto = useRef<ContextoLecturaMode01 | undefined>(undefined);
  const limpiar = useCallback(() => {
    contexto.current = undefined;
    establecerDeteccion(null);
  }, []);
  const establecer = useCallback(
    (
      resultado: ResultadoDeteccionPids,
      respuestasConfiguracion: Record<string, string>,
    ) => {
      contexto.current = {
        pidsSoportados: resultado.pidsSoportados,
        respuestasConfiguracion: { ...respuestasConfiguracion },
      };
      establecerDeteccion(resultado);
    },
    [],
  );
  return { deteccion, contexto, limpiar, establecer };
}
