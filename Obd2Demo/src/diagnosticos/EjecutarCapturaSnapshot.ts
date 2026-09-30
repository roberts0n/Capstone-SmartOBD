import { version as versionAplicacion } from '../../package.json';
import type { SesionEscanerObd } from '../escaner/TiposSesionEscaner';
import type { SesionTaller } from '../tipos/usuarioTaller';
import {
  capturarYGuardarSnapshotDiagnostico,
  validarInicioCapturaSnapshot,
} from './CapturarSnapshotDiagnostico';
import type {
  OpcionesCapturaSnapshot,
  ProgresoCapturaSnapshot,
  ResultadoCapturaGuardada,
} from './TiposCapturaSnapshot';
import type {
  MotivoSnapshotParcial,
  TipoSnapshotDiagnostico,
} from './TiposSnapshotDiagnostico';

const COMANDOS_PREPARACION = ['ATE0', 'ATL0', 'ATS1', 'ATH0', 'ATSP0'] as const;
const capturasEnCurso = new Set<string>();

export interface SolicitudCapturaSnapshotEscaner {
  casoId: string;
  tipo: TipoSnapshotDiagnostico;
  sesionTaller: SesionTaller;
  sesionEscaner: SesionEscanerObd;
  motivoParcialInicial?: MotivoSnapshotParcial | null;
  cancelado?: () => boolean;
  alProgresar?: (progreso: ProgresoCapturaSnapshot) => void;
}

/**
 * Une la conexion compartida con la captura y el guardado del snapshot.
 * No depende de una pantalla, asi que el caso o el chatbot pueden reutilizarlo.
 */
export async function ejecutarCapturaSnapshotDesdeEscaner(
  solicitud: SolicitudCapturaSnapshotEscaner,
): Promise<ResultadoCapturaGuardada> {
  const { sesionEscaner } = solicitud;
  const dispositivo = sesionEscaner.dispositivoConectado;
  const escritura = sesionEscaner.escrituraSeleccionada;
  const notificacion = sesionEscaner.notificacionSeleccionada;
  const cancelado = solicitud.cancelado ?? (() => false);

  const opcionesBase: Pick<OpcionesCapturaSnapshot, 'casoId' | 'tipo'> = {
    casoId: solicitud.casoId,
    tipo: solicitud.tipo,
  };
  // valido el permiso antes de iniciar comandos que pueden tardar varios segundos
  validarInicioCapturaSnapshot(opcionesBase, solicitud.sesionTaller);

  if (!dispositivo) {
    throw new Error('Conecta un escaner antes de capturar el snapshot.');
  }
  if (!escritura || !notificacion) {
    throw new Error(
      'Verifica los canales de escritura y notificacion antes de capturar.',
    );
  }
  if (capturasEnCurso.has(dispositivo.id)) {
    throw new Error('Ya existe una captura en curso para este escaner.');
  }

  const versionConexion = sesionEscaner.obtenerVersionConexion();
  const mismaConexion = () =>
    versionConexion === sesionEscaner.obtenerVersionConexion() &&
    sesionEscaner.conectado();

  capturasEnCurso.add(dispositivo.id);
  try {
    await prepararEscaner(
      sesionEscaner,
      mismaConexion,
      cancelado,
      solicitud.alProgresar,
    );

    const opciones: OpcionesCapturaSnapshot = {
      casoId: solicitud.casoId,
      tipo: solicitud.tipo,
      dispositivo,
      escritura,
      notificacion,
      versionAplicacion,
      motivoParcialInicial: solicitud.motivoParcialInicial,
      enviar: comando => sesionEscaner.enviarComando(comando),
      conectado: mismaConexion,
      sincronizado: sesionEscaner.estaSincronizado,
      cancelado,
      alProgresar: solicitud.alProgresar,
    };

    return await capturarYGuardarSnapshotDiagnostico(
      opciones,
      solicitud.sesionTaller,
    );
  } finally {
    capturasEnCurso.delete(dispositivo.id);
  }
}

async function prepararEscaner(
  sesionEscaner: SesionEscanerObd,
  conectado: () => boolean,
  cancelado: () => boolean,
  alProgresar?: (progreso: ProgresoCapturaSnapshot) => void,
): Promise<void> {
  if (!sesionEscaner.estaSuscrito() && !sesionEscaner.activarSuscripcion()) {
    throw new Error('No se pudo activar la recepcion del escaner.');
  }

  for (let indice = 0; indice < COMANDOS_PREPARACION.length; indice += 1) {
    const comando = COMANDOS_PREPARACION[indice];
    if (cancelado()) {
      throw new Error('La preparacion del escaner fue cancelada.');
    }
    if (!conectado() || !sesionEscaner.estaSincronizado()) {
      throw new Error('La conexion se interrumpio mientras se preparaba el escaner.');
    }

    alProgresar?.({
      etapa: 'preparando-escaner',
      actual: indice + 1,
      total: COMANDOS_PREPARACION.length,
      mensaje: `Preparando el escaner con ${comando}.`,
    });
    await sesionEscaner.enviarComando(comando);
  }
}
