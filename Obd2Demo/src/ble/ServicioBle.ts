import {
  BleManager,
  type BleError,
  type Device,
  State,
  type Subscription,
} from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import type {
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
} from '../tipos/ble';

export interface ConexionGatt {
  dispositivo: Device;
  caracteristicas: InformacionCaracteristicaGatt[];
}

/**
 * Encapsula todas las operaciones de react-native-ble-plx.
 *
 * La pantalla trabaja con metodos de alto nivel y no necesita conocer los
 * detalles del BleManager. Este servicio no contiene reglas de ELM327.
 */
export class ServicioBle {
  // Se mantiene una sola instancia durante la vida de la pantalla.
  private readonly administrador = new BleManager();
  private idDispositivoConectado: string | null = null;

  /** Solicita los permisos que corresponden a la version de Android. */
  async solicitarPermisosAndroid(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    const nivelApi = Number(Platform.Version);
    // Android 12 (API 31) separo escaneo y conexion. Versiones anteriores
    // requieren ubicacion para permitir el escaneo BLE.
    const permisos =
      nivelApi >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

    const resultados = await PermissionsAndroid.requestMultiple(permisos);
    return permisos.every(
      permiso => resultados[permiso] === PermissionsAndroid.RESULTS.GRANTED,
    );
  }

  async obtenerEstadoBluetooth(): Promise<State> {
    return this.administrador.state();
  }

  /** Escucha cambios como PoweredOn, PoweredOff o Unauthorized. */
  observarEstadoBluetooth(
    alCambiar: (estado: State) => void,
    emitirEstadoActual = true,
  ): Subscription {
    return this.administrador.onStateChange(alCambiar, emitirEstadoActual);
  }

  /**
   * Inicia una busqueda de todos los dispositivos BLE cercanos.
   * Los resultados se convierten a InformacionDispositivoBle antes de llegar a
   * la pantalla.
   */
  iniciarEscaneo(
    alEncontrarDispositivo: (dispositivo: InformacionDispositivoBle) => void,
    alOcurrirError: (error: BleError) => void,
  ): void {
    this.detenerEscaneo();
    this.administrador.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error, dispositivo) => {
        if (error) {
          alOcurrirError(error);
          return;
        }
        if (!dispositivo) {
          return;
        }
        alEncontrarDispositivo({
          id: dispositivo.id,
          nombre: dispositivo.name,
          nombreLocal: dispositivo.localName,
          rssi: dispositivo.rssi,
        });
      },
    );
  }

  detenerEscaneo(): void {
    this.administrador.stopDeviceScan();
  }

  /**
   * Conecta un dispositivo y crea un inventario plano de sus caracteristicas.
   * El numero mostrado como GATT (N) en la interfaz es el largo de esta lista.
   */
  async conectarYDescubrir(idDispositivo: string): Promise<ConexionGatt> {
    this.detenerEscaneo();
    const dispositivo = await this.administrador.connectToDevice(
      idDispositivo,
      { timeout: 12000 },
    );
    this.idDispositivoConectado = dispositivo.id;
    const dispositivoDescubierto =
      await dispositivo.discoverAllServicesAndCharacteristics();
    const servicios = await dispositivoDescubierto.services();
    const caracteristicas: InformacionCaracteristicaGatt[] = [];

    for (const servicio of servicios) {
      const caracteristicasServicio = await servicio.characteristics();
      for (const caracteristica of caracteristicasServicio) {
        caracteristicas.push({
          uuidServicio: servicio.uuid,
          uuidCaracteristica: caracteristica.uuid,
          permiteLectura: caracteristica.isReadable,
          permiteEscrituraConRespuesta: caracteristica.isWritableWithResponse,
          permiteEscrituraSinRespuesta:
            caracteristica.isWritableWithoutResponse,
          permiteNotificacion: caracteristica.isNotifiable,
          permiteIndicacion: caracteristica.isIndicatable,
        });
      }
    }

    return {
      dispositivo: dispositivoDescubierto,
      caracteristicas,
    };
  }

  /** Registra un aviso para desconexiones voluntarias o inesperadas. */
  observarDesconexion(
    idDispositivo: string,
    alDesconectarse: (error: BleError | null) => void,
  ): Subscription {
    return this.administrador.onDeviceDisconnected(idDispositivo, error =>
      alDesconectarse(error),
    );
  }

  /**
   * Se suscribe a notificaciones o indicaciones de una caracteristica RX.
   * react-native-ble-plx entrega el valor recibido como texto Base64.
   */
  monitorear(
    idDispositivo: string,
    caracteristica: InformacionCaracteristicaGatt,
    alRecibir: (error: BleError | null, valorBase64: string | null) => void,
  ): Subscription {
    return this.administrador.monitorCharacteristicForDevice(
      idDispositivo,
      caracteristica.uuidServicio,
      caracteristica.uuidCaracteristica,
      (error, caracteristicaActualizada) =>
        alRecibir(error, caracteristicaActualizada?.value ?? null),
    );
  }

  /**
   * Escribe un valor Base64 en la caracteristica TX seleccionada.
   * Se prefiere escritura con respuesta porque confirma la entrega a nivel BLE.
   */
  async escribir(
    idDispositivo: string,
    caracteristica: InformacionCaracteristicaGatt,
    valorBase64: string,
  ): Promise<void> {
    if (caracteristica.permiteEscrituraConRespuesta) {
      await this.administrador.writeCharacteristicWithResponseForDevice(
        idDispositivo,
        caracteristica.uuidServicio,
        caracteristica.uuidCaracteristica,
        valorBase64,
      );
      return;
    }
    if (caracteristica.permiteEscrituraSinRespuesta) {
      await this.administrador.writeCharacteristicWithoutResponseForDevice(
        idDispositivo,
        caracteristica.uuidServicio,
        caracteristica.uuidCaracteristica,
        valorBase64,
      );
      return;
    }
    throw new Error('La característica seleccionada no admite escritura.');
  }

  /** Detiene el escaneo y cierra la conexion activa, si existe. */
  async desconectar(): Promise<void> {
    this.detenerEscaneo();
    const idDispositivo = this.idDispositivoConectado;
    this.idDispositivoConectado = null;
    if (
      idDispositivo &&
      (await this.administrador.isDeviceConnected(idDispositivo))
    ) {
      await this.administrador.cancelDeviceConnection(idDispositivo);
    }
  }

  /** Libera conexion, escaneo y recursos nativos al desmontar la pantalla. */
  async destruir(): Promise<void> {
    try {
      await this.desconectar();
    } finally {
      this.administrador.destroy();
    }
  }
}

// Helpers usados por la pantalla para traducir State a decisiones de interfaz.
export const esBluetoothUtilizable = (estado: State): boolean =>
  estado === State.PoweredOn;

export const esBluetoothNoDisponible = (estado: State): boolean =>
  estado === State.Unsupported || estado === State.Unauthorized;
