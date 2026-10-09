import { useEffect, useRef, useState } from 'react';
import { useSesionEscanerObd } from '../escaner/ContextoEscanerObd';
import type { SesionTaller } from '../tipos/usuarioTaller';
import {
  ErrorRecargaSnapshot,
  obtenerSnapshotDiagnostico,
} from './ServicioSnapshotsDiagnostico';
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
  const [pendienteRecuperacion, establecerPendienteRecuperacion] =
    useState<ErrorRecargaSnapshot | null>(null);
  const guardando = useRef(false);
  const pendienteActual = useRef<ErrorRecargaSnapshot | null>(null);
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
    if (ocupado.current || pendienteActual.current) {
      return null;
    }

    ocupado.current = true;
    cancelacionSolicitada.current = false;
    guardando.current = false;
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
        if (siguiente.etapa === 'guardando') guardando.current = true;
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
      return montado.current ? captura : null;
    } catch (capturado) {
      if (montado.current) {
        if (capturado instanceof ErrorRecargaSnapshot) {
          pendienteActual.current = capturado;
          establecerPendienteRecuperacion(capturado);
          establecerError(capturado.message);
        } else if (cancelacionSolicitada.current && !guardando.current) {
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
    if (!ocupado.current || guardando.current) {
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

  async function recuperar(): Promise<ResultadoCapturaGuardada | null> {
    if (ocupado.current || !pendienteRecuperacion?.contexto) return null;
    ocupado.current = true;
    guardando.current = true;
    establecerEnCurso(true);
    establecerError(null);
    try {
      const snapshotGuardado = await obtenerSnapshotDiagnostico(
        pendienteRecuperacion.snapshotId,
      );
      if (!snapshotGuardado)
        throw new Error('No se pudo recuperar el snapshot guardado.');
      const recuperado = {
        ...pendienteRecuperacion.contexto,
        snapshotGuardado,
      };
      if (!montado.current) return null;
      establecerResultado(recuperado);
      pendienteActual.current = null;
      establecerPendienteRecuperacion(null);
      return recuperado;
    } catch (capturado) {
      if (montado.current) establecerError(mensajeError(capturado));
      return null;
    } finally {
      ocupado.current = false;
      if (montado.current) establecerEnCurso(false);
    }
  }

  function limpiar(): void {
    if (ocupado.current || pendienteRecuperacion) {
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
    pendienteRecuperacion,
    puedeCancelar: enCurso && !guardando.current,
    recuperar,
    iniciar,
    cancelar,
    limpiar,
  };
}

function mensajeError(capturado: unknown): string {
  return capturado instanceof Error ? capturado.message : String(capturado);
}
