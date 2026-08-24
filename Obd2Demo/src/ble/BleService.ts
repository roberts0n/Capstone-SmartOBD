import {
  BleManager,
  type BleError,
  type Device,
  State,
  type Subscription,
} from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import type { BleDeviceInfo, GattCharacteristicInfo } from '../types/ble';

export interface ConnectedGatt {
  device: Device;
  characteristics: GattCharacteristicInfo[];
}

/**
 * Encapsula todas las operaciones de react-native-ble-plx.
 *
 * La pantalla trabaja con metodos de alto nivel y no necesita conocer los
 * detalles del BleManager. Este servicio no contiene reglas de ELM327.
 */
export class BleService {
  // Se mantiene una sola instancia durante la vida de la pantalla.
  private readonly manager = new BleManager();
  private connectedDeviceId: string | null = null;

  /** Solicita los permisos que corresponden a la version de Android. */
  async requestAndroidPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    const apiLevel = Number(Platform.Version);
    // Android 12 (API 31) separo escaneo y conexion. Versiones anteriores
    // requieren ubicacion para permitir el escaneo BLE.
    const permissions =
      apiLevel >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

    const results = await PermissionsAndroid.requestMultiple(permissions);
    return permissions.every(
      permission => results[permission] === PermissionsAndroid.RESULTS.GRANTED,
    );
  }

  async getBluetoothState(): Promise<State> {
    return this.manager.state();
  }

  /** Escucha cambios como PoweredOn, PoweredOff o Unauthorized. */
  onBluetoothStateChange(
    listener: (state: State) => void,
    emitCurrentState = true,
  ): Subscription {
    return this.manager.onStateChange(listener, emitCurrentState);
  }

  /**
   * Inicia una busqueda de todos los dispositivos BLE cercanos.
   * Los resultados se convierten a BleDeviceInfo antes de llegar a la pantalla.
   */
  startScan(
    onDevice: (device: BleDeviceInfo) => void,
    onError: (error: BleError) => void,
  ): void {
    this.stopScan();
    this.manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          onError(error);
          return;
        }
        if (!device) {
          return;
        }
        onDevice({
          id: device.id,
          name: device.name,
          localName: device.localName,
          rssi: device.rssi,
        });
      },
    );
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  /**
   * Conecta un dispositivo y crea un inventario plano de sus caracteristicas.
   * El numero mostrado como GATT (N) en la interfaz es el largo de esta lista.
   */
  async connectAndDiscover(deviceId: string): Promise<ConnectedGatt> {
    this.stopScan();
    const device = await this.manager.connectToDevice(deviceId, {
      timeout: 12000,
    });
    this.connectedDeviceId = device.id;
    const discovered = await device.discoverAllServicesAndCharacteristics();
    const services = await discovered.services();
    const characteristics: GattCharacteristicInfo[] = [];

    for (const service of services) {
      const serviceCharacteristics = await service.characteristics();
      for (const characteristic of serviceCharacteristics) {
        characteristics.push({
          serviceUUID: service.uuid,
          characteristicUUID: characteristic.uuid,
          isReadable: characteristic.isReadable,
          isWritableWithResponse: characteristic.isWritableWithResponse,
          isWritableWithoutResponse: characteristic.isWritableWithoutResponse,
          isNotifiable: characteristic.isNotifiable,
          isIndicatable: characteristic.isIndicatable,
        });
      }
    }

    return { device: discovered, characteristics };
  }

  /** Registra un aviso para desconexiones voluntarias o inesperadas. */
  onDisconnected(
    deviceId: string,
    listener: (error: BleError | null) => void,
  ): Subscription {
    return this.manager.onDeviceDisconnected(deviceId, error =>
      listener(error),
    );
  }

  /**
   * Se suscribe a notificaciones o indicaciones de una caracteristica RX.
   * react-native-ble-plx entrega el valor recibido como texto Base64.
   */
  monitor(
    deviceId: string,
    characteristic: GattCharacteristicInfo,
    listener: (error: BleError | null, base64Value: string | null) => void,
  ): Subscription {
    return this.manager.monitorCharacteristicForDevice(
      deviceId,
      characteristic.serviceUUID,
      characteristic.characteristicUUID,
      (error, updatedCharacteristic) =>
        listener(error, updatedCharacteristic?.value ?? null),
    );
  }

  /**
   * Escribe un valor Base64 en la caracteristica TX seleccionada.
   * Se prefiere escritura con respuesta porque confirma la entrega a nivel BLE.
   */
  async write(
    deviceId: string,
    characteristic: GattCharacteristicInfo,
    base64Value: string,
  ): Promise<void> {
    if (characteristic.isWritableWithResponse) {
      await this.manager.writeCharacteristicWithResponseForDevice(
        deviceId,
        characteristic.serviceUUID,
        characteristic.characteristicUUID,
        base64Value,
      );
      return;
    }
    if (characteristic.isWritableWithoutResponse) {
      await this.manager.writeCharacteristicWithoutResponseForDevice(
        deviceId,
        characteristic.serviceUUID,
        characteristic.characteristicUUID,
        base64Value,
      );
      return;
    }
    throw new Error('La característica seleccionada no admite escritura.');
  }

  /** Detiene el escaneo y cierra la conexion activa, si existe. */
  async disconnect(): Promise<void> {
    this.stopScan();
    const deviceId = this.connectedDeviceId;
    this.connectedDeviceId = null;
    if (deviceId && (await this.manager.isDeviceConnected(deviceId))) {
      await this.manager.cancelDeviceConnection(deviceId);
    }
  }

  /** Libera conexion, escaneo y recursos nativos al desmontar la pantalla. */
  async destroy(): Promise<void> {
    try {
      await this.disconnect();
    } finally {
      this.manager.destroy();
    }
  }
}

// Helpers usados por la pantalla para traducir State a decisiones de interfaz.
export const isBluetoothUsable = (state: State): boolean =>
  state === State.PoweredOn;

export const isBluetoothUnavailable = (state: State): boolean =>
  state === State.Unsupported || state === State.Unauthorized;
