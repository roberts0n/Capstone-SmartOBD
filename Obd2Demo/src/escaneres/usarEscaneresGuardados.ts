import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EscanerGuardado } from '../tipos/escaner';
import { RepositorioEscaneres } from './RepositorioEscaneres';

const repositorio = new RepositorioEscaneres(createAsyncStorage('smartobd'));

/** Sincroniza la vista solo despues de confirmar la escritura en el telefono. */
// El prefijo "use" es obligatorio para que React reconozca un hook personalizado.
export function useEscaneresGuardados() {
  const [guardados, establecerGuardados] = useState<EscanerGuardado[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState<string | null>(null);
  const montado = useRef(true);
  const guardadosActuales = useRef<EscanerGuardado[]>([]);

  const conservarGuardados = useCallback((datos: EscanerGuardado[]) => {
    guardadosActuales.current = datos;
    establecerGuardados(datos);
  }, []);

  useEffect(() => {
    montado.current = true;
    repositorio
      .cargar()
      .then(datos => {
        if (montado.current) {
          conservarGuardados(datos);
        }
      })
      .catch(capturado => {
        if (montado.current) {
          establecerError(String(capturado));
        }
      })
      .finally(() => {
        if (montado.current) {
          establecerCargando(false);
        }
      });
    return () => {
      montado.current = false;
    };
  }, [conservarGuardados]);

  const actualizar = useCallback(
    async (operacion: Promise<EscanerGuardado[]>) => {
      try {
        const datos = await operacion;
        if (montado.current) {
          conservarGuardados(datos);
          establecerError(null);
        }
      } catch (capturado) {
        if (montado.current) {
          establecerError(String(capturado));
        }
        throw capturado;
      }
    },
    [conservarGuardados],
  );

  return {
    guardados,
    cargando,
    error,
    buscar: (id: string) =>
      guardadosActuales.current.find(escaner => escaner.id === id),
    guardar: (escaner: EscanerGuardado) =>
      actualizar(repositorio.guardar(escaner)),
    olvidar: (id: string) => actualizar(repositorio.olvidar(id)),
  };
}
