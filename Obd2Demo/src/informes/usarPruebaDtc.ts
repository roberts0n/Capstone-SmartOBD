import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  ejecutarPruebaDtc,
  type InformePruebaDtc,
  type OpcionesPruebaDtc,
} from '../obd/dtc/PruebaDtc';
import { RepositorioInformeDtc } from './RepositorioInformeDtc';
import { guardarInformeDtc } from './guardarInformeDtc';

const repositorio = new RepositorioInformeDtc(createAsyncStorage('smartobd'));
type EntradaPrueba = Omit<
  OpcionesPruebaDtc,
  'guardarAvance' | 'alProgresar' | 'cancelado' | 'condiciones'
>;

/** React coordina el estado visual; la secuencia OBD vive fuera del hook. */
export function usePruebaDtc() {
  const [informe, establecerInforme] = useState<InformePruebaDtc | null>(null);
  const [progreso, establecerProgreso] = useState('Sin prueba ejecutada.');
  const [notas, establecerNotas] = useState('');
  const [cargando, establecerCargando] = useState(true);
  const [ejecutando, establecerEjecutando] = useState(false);
  const [guardando, establecerGuardando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const montado = useRef(true);
  const cancelar = useRef(false);
  const ocupado = useRef(false);
  const exportando = useRef(false);

  useEffect(() => {
    montado.current = true;
    repositorio
      .recuperar()
      .then(datos => {
        if (montado.current && datos) {
          establecerInforme(datos);
          establecerProgreso(
            `Informe recuperado: ${datos.estado}. Puedes exportarlo sin conectar.`,
          );
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
      cancelar.current = true;
    };
  }, []);

  async function iniciar(entrada: EntradaPrueba) {
    if (ocupado.current || cargando || exportando.current) {
      return;
    }
    ocupado.current = true;
    cancelar.current = false;
    establecerEjecutando(true);
    establecerError(null);
    try {
      await ejecutarPruebaDtc({
        ...entrada,
        condiciones: notas,
        cancelado: () => cancelar.current,
        guardarAvance: datos => repositorio.guardar(datos),
        alProgresar: (datos, mensaje) => {
          if (montado.current) {
            establecerInforme(datos);
            establecerProgreso(mensaje);
          }
        },
      });
    } catch (capturado) {
      if (montado.current) {
        establecerError(String(capturado));
      }
    } finally {
      ocupado.current = false;
      if (montado.current) {
        establecerEjecutando(false);
      }
    }
  }

  async function guardar() {
    if (!informe || ocupado.current || exportando.current) {
      return;
    }
    exportando.current = true;
    establecerGuardando(true);
    establecerError(null);
    try {
      const uri = await guardarInformeDtc(informe);
      if (montado.current) {
        establecerProgreso(
          uri
            ? 'Informe JSON guardado en la ubicación elegida.'
            : 'Guardado cancelado. El informe sigue disponible.',
        );
      }
    } catch (capturado) {
      if (montado.current) {
        establecerError(String(capturado));
      }
    } finally {
      exportando.current = false;
      if (montado.current) {
        establecerGuardando(false);
      }
    }
  }

  return {
    informe,
    progreso,
    notas,
    establecerNotas,
    cargando,
    ejecutando,
    guardando,
    error,
    iniciar,
    guardar,
    detener: () => {
      cancelar.current = true;
      establecerProgreso('Deteniendo al terminar el comando actual…');
    },
  };
}
