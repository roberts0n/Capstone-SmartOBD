import type { State } from 'react-native-ble-plx';
import type { EstadoPermisosBluetooth } from './ServicioBle';
import type { EscanerGuardado } from '../tipos/escaner';
import type {
  EntradaConsola,
  EstadoConexion,
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
  RespuestaElm,
} from '../tipos/ble';

export interface ResultadoConexionEscaner {
  dispositivo: InformacionDispositivoBle;
  caracteristicas: InformacionCaracteristicaGatt[];
}

export interface OpcionesEnvioEscaner {
  escritura?: InformacionCaracteristicaGatt;
  tiempoEsperaMs?: number;
}

export interface SesionEscanerObd {
  estadoPermisos: EstadoPermisosBluetooth;
  estadoPreparacion:
    | 'sin-verificar'
    | 'conectando'
    | 'verificando'
    | 'preparado'
    | 'error';
  advertenciaGuardado: string | null;
  escaneresGuardados: EscanerGuardado[];
  cargandoGuardados: boolean;
  errorGuardados: string | null;
  actualizarBluetooth: (solicitar?: boolean) => Promise<boolean>;
  conectarYVerificar: (
    dispositivo: InformacionDispositivoBle,
  ) => Promise<string | null>;
  verificarCanalesAutomaticamente: () => Promise<string | null>;
  cancelarPreparacion: () => Promise<void>;
  estaPreparado: () => boolean;
  confirmarVerificacion: (
    respuesta: string,
    version: number,
    escritura: InformacionCaracteristicaGatt,
    notificacion: InformacionCaracteristicaGatt,
  ) => boolean;
  olvidarEscaner: (id: string) => Promise<void>;
  guardarEscaner: (escaner: EscanerGuardado) => Promise<void>;
  estadoBluetooth: State;
  estadoConexion: EstadoConexion;
  dispositivos: InformacionDispositivoBle[];
  idDispositivoSeleccionado: string | null;
  dispositivoConectado: InformacionDispositivoBle | null;
  caracteristicas: InformacionCaracteristicaGatt[];
  escrituraSeleccionada: InformacionCaracteristicaGatt | null;
  notificacionSeleccionada: InformacionCaracteristicaGatt | null;
  claveEscritura: string | null;
  claveNotificacion: string | null;
  claveSuscripcion: string | null;
  conexionEnCurso: boolean;
  mensajeVerificacion: string;
  entradasConsola: EntradaConsola[];
  prepararBluetooth: () => Promise<boolean>;
  iniciarEscaneo: () => Promise<void>;
  detenerEscaneo: () => void;
  conectar: (
    dispositivo: InformacionDispositivoBle,
  ) => Promise<ResultadoConexionEscaner>;
  desconectar: () => Promise<void>;
  elegirEscritura: (elemento: InformacionCaracteristicaGatt) => void;
  elegirNotificacion: (elemento: InformacionCaracteristicaGatt) => void;
  seleccionarCanales: (
    escritura: InformacionCaracteristicaGatt,
    notificacion: InformacionCaracteristicaGatt,
  ) => void;
  activarSuscripcion: (notificacion?: InformacionCaracteristicaGatt) => boolean;
  cancelarSuscripcion: () => void;
  enviarComando: (
    comando: string,
    opciones?: OpcionesEnvioEscaner,
  ) => Promise<RespuestaElm>;
  estaSuscrito: () => boolean;
  estaSincronizado: () => boolean;
  conectado: () => boolean;
  obtenerVersionConexion: () => number;
  establecerMensajeVerificacion: (mensaje: string) => void;
  marcarError: (mensaje: string) => void;
  marcarConectado: () => void;
  agregarRegistro: (nivel: EntradaConsola['nivel'], mensaje: string) => void;
  limpiarRegistros: () => void;
}
