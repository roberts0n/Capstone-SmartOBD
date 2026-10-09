import { version as versionAplicacion } from '../../package.json';
import type { SesionEscanerObd } from '../escaner/TiposSesionEscaner';
import type { SesionTaller } from '../tipos/usuarioTaller';
import {
  capturarSnapshotDiagnostico,
  validarInicioCapturaSnapshot,
} from './CapturarSnapshotDiagnostico';
import {
  ErrorRecargaSnapshot,
  guardarSnapshotDiagnostico,
} from './ServicioSnapshotsDiagnostico';
import type {
  CondicionMotorSnapshot,
  OpcionesCapturaSnapshot,
  ProgresoCapturaSnapshot,
  ResultadoCapturaGuardada,
  MotivoSnapshotParcial,
  TipoSnapshotDiagnostico,
} from './TiposSnapshotDiagnostico';
import { verificarMotorEnMarcha } from './VerificarCondicionMotor';
import { ejecutarLecturaVin } from '../obd/LecturaVin';
import { asignarVinVehiculo } from '../vehiculos/ServicioVehiculos';

const COMANDOS_PREPARACION = ['ATE0', 'ATL0', 'ATS1', 'ATH0', 'ATSP0'] as const;
const capturasEnCurso = new Set<string>();

export interface SolicitudCapturaSnapshotEscaner {
  casoId: string;
  vehiculoId: string;
  tipo: TipoSnapshotDiagnostico;
  condicionMotor: CondicionMotorSnapshot;
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
  if (!sesionEscaner.estaPreparado()) {
    throw new Error(
      'Verifica el escáner con ATI en esta conexión antes de capturar.',
    );
  }
  if (capturasEnCurso.has(dispositivo.id)) {
    throw new Error('Ya existe una captura en curso para este escaner.');
  }

  const versionConexion = sesionEscaner.obtenerVersionConexion();
  const mismaConexion = () =>
    versionConexion === sesionEscaner.obtenerVersionConexion() &&
    sesionEscaner.conectado();
  const comprobarCancelacion = () => {
    if (cancelado())
      throw new Error('La captura fue cancelada y no se guardo el snapshot.');
  };
  const enviarComprobado: SesionEscanerObd['enviarComando'] = async comando => {
    comprobarCancelacion();
    if (!mismaConexion())
      throw new Error('La conexion del escaner cambio durante la captura.');
    const respuesta = await sesionEscaner.enviarComando(comando);
    comprobarCancelacion();
    if (!mismaConexion())
      throw new Error('La conexion del escaner cambio durante la captura.');
    return respuesta;
  };

  capturasEnCurso.add(dispositivo.id);
  try {
    await prepararEscaner(
      sesionEscaner,
      mismaConexion,
      cancelado,
      solicitud.alProgresar,
    );
    comprobarCancelacion();

    let verificacionMotorInicial = null;
    if (solicitud.condicionMotor === 'en_marcha') {
      solicitud.alProgresar?.({
        etapa: 'verificando-motor',
        actual: 0,
        total: 2,
        mensaje: 'Comprobando que el motor este en marcha.',
      });
      verificacionMotorInicial = await verificarMotorEnMarcha(
        enviarComprobado,
        cancelado,
      );
      if (verificacionMotorInicial.estado === 'detenido') {
        throw new Error(
          'El motor no esta en marcha. Enciendelo o utiliza la captura parcial para un vehiculo que no arranca.',
        );
      }
      if (verificacionMotorInicial.estado === 'no-verificable') {
        throw new Error(
          `No se pudieron verificar las RPM: ${verificacionMotorInicial.mensaje}`,
        );
      }
    }

    solicitud.alProgresar?.({
      etapa: 'leyendo-vin',
      actual: null,
      total: null,
      mensaje: 'Consultando el VIN del vehiculo.',
    });
    const lecturaVin = await ejecutarLecturaVin(enviarComprobado);
    comprobarCancelacion();
    if (lecturaVin.vin) {
      await asignarVinVehiculo(
        solicitud.vehiculoId,
        lecturaVin.vin,
        solicitud.sesionTaller,
      );
      comprobarCancelacion();
    }

    const opciones: OpcionesCapturaSnapshot = {
      casoId: solicitud.casoId,
      tipo: solicitud.tipo,
      dispositivo,
      escritura,
      notificacion,
      versionAplicacion,
      motivoParcialInicial:
        solicitud.condicionMotor === 'no_arranca'
          ? 'motor_no_arranca'
          : solicitud.motivoParcialInicial,
      enviar: comando => sesionEscaner.enviarComando(comando),
      conectado: mismaConexion,
      sincronizado: sesionEscaner.estaSincronizado,
      cancelado,
      alProgresar: solicitud.alProgresar,
    };

    const captura = await capturarSnapshotDiagnostico(opciones);
    comprobarCancelacion();
    let verificacionMotorFinal = null;
    if (solicitud.condicionMotor === 'en_marcha' && !captura.cancelada) {
      solicitud.alProgresar?.({
        etapa: 'verificando-motor',
        actual: 2,
        total: 2,
        mensaje: 'Comprobando que el motor siga en marcha.',
      });
      verificacionMotorFinal = await verificarMotorEnMarcha(
        enviarComprobado,
        cancelado,
      );
      if (verificacionMotorFinal.estado !== 'en-marcha') {
        captura.fallos.push({
          etapa: 'condicion-motor',
          comando: '010C',
          mensaje: verificacionMotorFinal.mensaje,
        });
        captura.snapshot.estado = 'parcial';
        captura.snapshot.motivoParcial = 'lecturas_incompletas';
      }
    }

    if (captura.cancelada || cancelado()) {
      throw new Error('La captura fue cancelada y no se guardo el snapshot.');
    }
    solicitud.alProgresar?.({
      etapa: 'guardando',
      actual: null,
      total: null,
      mensaje: 'Guardando el snapshot en el caso de diagnostico.',
    });
    comprobarCancelacion();
    const contexto = {
      captura,
      vinLeido: lecturaVin.vin,
      advertencias: lecturaVin.advertencia ? [lecturaVin.advertencia] : [],
      verificacionMotorInicial,
      verificacionMotorFinal,
    };
    try {
      const snapshotGuardado = await guardarSnapshotDiagnostico(
        captura.snapshot,
        solicitud.sesionTaller,
      );
      return { ...contexto, snapshotGuardado };
    } catch (capturado) {
      if (capturado instanceof ErrorRecargaSnapshot)
        capturado.contexto = contexto;
      throw capturado;
    }
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
      throw new Error(
        'La conexion se interrumpio mientras se preparaba el escaner.',
      );
    }

    alProgresar?.({
      etapa: 'preparando-escaner',
      actual: indice + 1,
      total: COMANDOS_PREPARACION.length,
      mensaje: `Preparando el escaner con ${comando}.`,
    });
    await sesionEscaner.enviarComando(comando);
    if (cancelado())
      throw new Error('La preparacion del escaner fue cancelada.');
  }
}
