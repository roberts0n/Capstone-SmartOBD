import { useEffect, useRef, useState } from 'react';
import { useSesionEscanerObd } from '../escaner/ContextoEscanerObd';
import type { SesionTaller } from '../tipos/usuarioTaller';
import {
  ejecutarCapturaSnapshotDesdeEscaner,
  type SolicitudCapturaSnapshotEscaner,
} from './EjecutarCapturaSnapshot';
import type {
  CondicionMotorSnapshot,
  ProgresoCapturaSnapshot,
  ResultadoCapturaGuardada,
  MotivoSnapshotParcial,
  TipoSnapshotDiagnostico,
} from './TiposSnapshotDiagnostico';

export interface EntradaCapturaSnapshot {
  casoId: string;
  vehiculoId: string;
  tipo: TipoSnapshotDiagnostico;
  condicionMotor: CondicionMotorSnapshot;
  sesionTaller: SesionTaller;
  motivoParcialInicial?: MotivoSnapshotParcial | null;
}

/** Mantiene el estado visual sin mezclarlo con la secuencia OBD. */
export function useCapturaSnapshot() {
  const sesionEscaner = useSesionEscanerObd();
  const [enCurso, establecerEnCurso] = useState(false);
  const [progreso, establecerProgreso] =
    useState<ProgresoCapturaSnapshot | null>(null);
  const [resultado, establecerResultado] =
    useState<ResultadoCapturaGuardada | null>(null);
  const [error, establecerError] = useState<string | null>(null);
  const montado = useRef(true);
  const ocupado = useRef(false);
  const cancelacionSolicitada = useRef(false);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      cancelacionSolicitada.current = true;
    };
  }, []);

  async function iniciar(
    entrada: EntradaCapturaSnapshot,
  ): Promise<ResultadoCapturaGuardada | null> {
    if (ocupado.current) {
      return null;
    }

    ocupado.current = true;
    cancelacionSolicitada.current = false;
    establecerEnCurso(true);
    establecerError(null);
    establecerResultado(null);
    establecerProgreso({
      etapa: 'preparando-escaner',
      actual: 0,
      total: 5,
      mensaje: 'Iniciando la captura del snapshot.',
    });

    const solicitud: SolicitudCapturaSnapshotEscaner = {
      ...entrada,
      sesionEscaner,
      cancelado: () => cancelacionSolicitada.current,
      alProgresar: siguiente => {
        if (montado.current) {
          establecerProgreso(siguiente);
        }
      },
    };

    try {
      const captura = await ejecutarCapturaSnapshotDesdeEscaner(solicitud);
      if (montado.current) {
        establecerResultado(captura);
        establecerProgreso({
          etapa: 'guardando',
          actual: 1,
          total: 1,
          mensaje: `Snapshot ${captura.snapshotGuardado.secuencia} guardado correctamente.`,
        });
      }
      return captura;
    } catch (capturado) {
      if (montado.current) {
        if (cancelacionSolicitada.current) {
          establecerProgreso(anterior => ({
            etapa: anterior?.etapa ?? 'preparando-escaner',
            actual: anterior?.actual ?? null,
            total: anterior?.total ?? null,
            mensaje: 'Captura cancelada. No se guardo el snapshot.',
          }));
        } else {
          establecerError(mensajeError(capturado));
        }
      }
      return null;
    } finally {
      ocupado.current = false;
      cancelacionSolicitada.current = false;
      if (montado.current) {
        establecerEnCurso(false);
      }
    }
  }

  function cancelar(): void {
    if (!ocupado.current) {
      return;
    }
    cancelacionSolicitada.current = true;
    establecerProgreso(anterior => ({
      etapa: anterior?.etapa ?? 'preparando-escaner',
      actual: anterior?.actual ?? null,
      total: anterior?.total ?? null,
      mensaje: 'Cancelando al terminar el comando actual...',
    }));
  }

  function limpiar(): void {
    if (ocupado.current) {
      return;
    }
    establecerProgreso(null);
    establecerResultado(null);
    establecerError(null);
  }

  return {
    enCurso,
    progreso,
    resultado,
    error,
    iniciar,
    cancelar,
    limpiar,
  };
}

function mensajeError(capturado: unknown): string {
  return capturado instanceof Error ? capturado.message : String(capturado);
}
