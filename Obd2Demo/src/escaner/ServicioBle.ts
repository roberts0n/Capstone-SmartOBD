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

export type EstadoPermisosBluetooth =
  | 'pendientes'
  | 'concedidos'
  | 'denegados'
  | 'bloqueados';

// aqui concentro el transporte bluetooth; las reglas de elm quedan aparte
export class ServicioBle {
  // mantengo una sola instancia mientras exista la sesion compartida
  private readonly administrador = new BleManager();
  private idDispositivoConectado: string | null = null;
  private temporizadorEscaneo: ReturnType<typeof setTimeout> | null = null;
  private sesionEscaneo = 0;
  private versionConexion = 0;
  private estadoPermisos: EstadoPermisosBluetooth = 'pendientes';
  private cancelacionPendiente: Promise<void> = Promise.resolve();

  /** Solicita los permisos que corresponden a la version de Android. */
  async solicitarPermisosAndroid(): Promise<boolean> {
    return (await this.consultarPermisosAndroid(true)) === 'concedidos';
  }

  async consultarPermisosAndroid(
    solicitar = false,
  ): Promise<EstadoPermisosBluetooth> {
    if (Platform.OS !== 'android') {
      return 'concedidos';
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

    const concedidos = await Promise.all(
      permisos.map(permiso => PermissionsAndroid.check(permiso)),
    );
    if (concedidos.every(Boolean)) {
      this.estadoPermisos = 'concedidos';
    } else if (solicitar) {
      const resultados = await PermissionsAndroid.requestMultiple(permisos);
      this.estadoPermisos = permisos.every(
        permiso => resultados[permiso] === PermissionsAndroid.RESULTS.GRANTED,
      )
        ? 'concedidos'
        : permisos.some(
            permiso =>
              resultados[permiso] ===
              PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
          )
        ? 'bloqueados'
        : 'denegados';
    } else if (this.estadoPermisos === 'concedidos') {
      this.estadoPermisos = 'pendientes';
    }
    return this.estadoPermisos;
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
    alFinalizar: () => void = () => undefined,
  ): void {
    this.detenerEscaneo();
    const sesion = this.sesionEscaneo;
    this.temporizadorEscaneo = setTimeout(() => {
      if (sesion !== this.sesionEscaneo) {
        return;
      }
      this.detenerEscaneo();
      alFinalizar();
    }, 12000);
    Promise.resolve(
      this.administrador.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error, dispositivo) => {
          if (sesion !== this.sesionEscaneo) {
            return;
          }
          if (error) {
            this.detenerEscaneo();
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
            serviciosAnunciados: dispositivo.serviceUUIDs,
            datosFabricante: dispositivo.manufacturerData,
          });
        },
      ),
    ).catch(error => {
      if (sesion === this.sesionEscaneo) {
        this.detenerEscaneo();
        alOcurrirError(error);
      }
    });
  }

  detenerEscaneo(): void {
    this.sesionEscaneo += 1;
    if (this.temporizadorEscaneo) {
      clearTimeout(this.temporizadorEscaneo);
      this.temporizadorEscaneo = null;
    }
    Promise.resolve(this.administrador.stopDeviceScan()).catch(() => undefined);
  }

  /**
   * Conecta un dispositivo y crea un inventario plano de sus caracteristicas.
   * El numero mostrado como GATT (N) en la interfaz es el largo de esta lista.
   */
  async conectarYDescubrir(idDispositivo: string): Promise<ConexionGatt> {
    this.detenerEscaneo();
    const version = ++this.versionConexion;
    const iniciar = async () => {
      await this.cancelacionPendiente;
      if (version !== this.versionConexion)
        throw new Error('Conexión cancelada.');
      // conservo el id desde el intento para poder cancelar tambien una conexion pendiente
      this.idDispositivoConectado = idDispositivo;
      return this.descubrir(idDispositivo, version);
    };
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        iniciar(),
        new Promise<never>((_, rechazar) => {
          temporizador = setTimeout(() => {
            this.desconectar().catch(() => undefined);
            rechazar(
              new Error('Tiempo agotado conectando o descubriendo el escáner.'),
            );
          }, 15000);
        }),
      ]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  private async descubrir(
    idDispositivo: string,
    version: number,
  ): Promise<ConexionGatt> {
    const comprobar = () => {
      if (version !== this.versionConexion)
        throw new Error('Conexión cancelada.');
    };
    const dispositivo = await this.administrador.connectToDevice(
      idDispositivo,
      { timeout: 12000 },
    );
    comprobar();
    const dispositivoDescubierto =
      await dispositivo.discoverAllServicesAndCharacteristics();
    comprobar();
    const servicios = await dispositivoDescubierto.services();
    comprobar();
    const caracteristicas: InformacionCaracteristicaGatt[] = [];

    for (const servicio of servicios) {
      const caracteristicasServicio = await servicio.characteristics();
      comprobar();
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
    this.versionConexion += 1;
    const idDispositivo = this.idDispositivoConectado;
    this.idDispositivoConectado = null;
    if (idDispositivo) {
      const cancelacion = Promise.resolve(
        this.administrador.cancelDeviceConnection(idDispositivo),
      );
      this.cancelacionPendiente = cancelacion.then(
        () => undefined,
        () => undefined,
      );
      await cancelacion;
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
