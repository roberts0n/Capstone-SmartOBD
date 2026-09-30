import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { State, type Subscription } from 'react-native-ble-plx';
import {
  esBluetoothNoDisponible,
  esBluetoothUtilizable,
  ServicioBle,
} from '../ble/ServicioBle';
import { combinarAnuncios } from '../escaneres/PerfilesEscaner';
import { ServicioElm327 } from '../obd/ServicioElm327';
import type {
  EntradaConsola,
  EstadoConexion,
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
} from '../tipos/ble';
import type {
  OpcionesEnvioEscaner,
  ResultadoConexionEscaner,
  SesionEscanerObd,
} from './TiposSesionEscaner';

const MENSAJE_SIN_VERIFICAR = 'Sin verificar en esta conexión.';
const ContextoEscanerObd = createContext<SesionEscanerObd | null>(null);

export function ProveedorEscanerObd({ children }: PropsWithChildren) {
  const [servicioBle] = useState(() => new ServicioBle());
  const [servicioElm] = useState(() => new ServicioElm327(servicioBle));
  const [estadoBluetooth, establecerEstadoBluetooth] = useState<State>(
    State.Unknown,
  );
  const [estadoConexion, establecerEstadoConexion] =
    useState<EstadoConexion>('listo');
  const [dispositivos, establecerDispositivos] = useState<
    InformacionDispositivoBle[]
  >([]);
  const [idDispositivoSeleccionado, establecerIdDispositivoSeleccionado] =
    useState<string | null>(null);
  const [dispositivoConectado, establecerDispositivoConectado] =
    useState<InformacionDispositivoBle | null>(null);
  const [caracteristicas, establecerCaracteristicas] = useState<
    InformacionCaracteristicaGatt[]
  >([]);
  const [escrituraSeleccionada, establecerEscrituraSeleccionada] =
    useState<InformacionCaracteristicaGatt | null>(null);
  const [notificacionSeleccionada, establecerNotificacionSeleccionada] =
    useState<InformacionCaracteristicaGatt | null>(null);
  const [claveSuscripcion, establecerClaveSuscripcion] = useState<string | null>(
    null,
  );
  const [conexionEnCurso, establecerConexionEnCurso] = useState(false);
  const [mensajeVerificacion, establecerMensajeVerificacion] = useState(
    MENSAJE_SIN_VERIFICAR,
  );
  const [entradasConsola, establecerEntradasConsola] = useState<
    EntradaConsola[]
  >([]);

  const dispositivoRef = useRef<InformacionDispositivoBle | null>(null);
  const escrituraRef = useRef<InformacionCaracteristicaGatt | null>(null);
  const notificacionRef = useRef<InformacionCaracteristicaGatt | null>(null);
  const versionConexion = useRef(0);
  const secuenciaRegistro = useRef(0);
  const bloqueoConexion = useRef(false);
  const suscripcionDesconexion = useRef<Subscription | null>(null);

  const agregarRegistro = useCallback(
    (nivel: EntradaConsola['nivel'], mensaje: string) => {
      const entrada: EntradaConsola = {
        id: ++secuenciaRegistro.current,
        marcaTiempo: new Date().toLocaleTimeString(),
        nivel,
        mensaje,
      };
      establecerEntradasConsola(anteriores => [
        ...anteriores.slice(-199),
        entrada,
      ]);
    },
    [],
  );

  const limpiarSeleccion = useCallback(() => {
    dispositivoRef.current = null;
    escrituraRef.current = null;
    notificacionRef.current = null;
    establecerDispositivoConectado(null);
    establecerCaracteristicas([]);
    establecerEscrituraSeleccionada(null);
    establecerNotificacionSeleccionada(null);
    establecerClaveSuscripcion(null);
    establecerIdDispositivoSeleccionado(null);
    establecerMensajeVerificacion(MENSAJE_SIN_VERIFICAR);
  }, []);

  useEffect(() => {
    const suscripcionEstado = servicioBle.observarEstadoBluetooth(estado => {
      establecerEstadoBluetooth(estado);
      if (esBluetoothNoDisponible(estado) || estado === State.PoweredOff) {
        servicioBle.detenerEscaneo();
        servicioElm.cancelarSuscripcion();
        suscripcionDesconexion.current?.remove();
        suscripcionDesconexion.current = null;
        versionConexion.current += 1;
        limpiarSeleccion();
        establecerEstadoConexion('bluetooth-no-disponible');
      }
    });

    return () => {
      versionConexion.current += 1;
      suscripcionEstado.remove();
      suscripcionDesconexion.current?.remove();
      servicioElm.cancelarSuscripcion();
      servicioBle.destruir().catch(() => undefined);
    };
  }, [limpiarSeleccion, servicioBle, servicioElm]);

  const prepararBluetooth = useCallback(async (): Promise<boolean> => {
    try {
      const concedidos = await servicioBle.solicitarPermisosAndroid();
      if (!concedidos) {
        throw new Error('Permisos Bluetooth denegados.');
      }
      const estado = await servicioBle.obtenerEstadoBluetooth();
      establecerEstadoBluetooth(estado);
      if (!esBluetoothUtilizable(estado)) {
        establecerEstadoConexion('bluetooth-no-disponible');
        agregarRegistro(
          'error',
          `Bluetooth no está listo: ${estado}. Enciéndelo e intenta otra vez.`,
        );
        return false;
      }
      agregarRegistro('exito', 'Permisos concedidos y Bluetooth encendido.');
      if (!dispositivoRef.current) {
        establecerEstadoConexion('listo');
      }
      return true;
    } catch (capturado) {
      const mensaje = mensajeError(capturado);
      establecerEstadoConexion('error');
      agregarRegistro('error', mensaje);
      return false;
    }
  }, [agregarRegistro, servicioBle]);

  const iniciarEscaneo = useCallback(async () => {
    if (bloqueoConexion.current || !(await prepararBluetooth())) {
      return;
    }
    establecerDispositivos([]);
    establecerIdDispositivoSeleccionado(null);
    establecerEstadoConexion('buscando');
    agregarRegistro('informacion', 'Búsqueda BLE iniciada.');
    servicioBle.iniciarEscaneo(
      dispositivo => {
        establecerDispositivos(anteriores => {
          const indice = anteriores.findIndex(
            elemento => elemento.id === dispositivo.id,
          );
          const siguientes = [...anteriores];
          if (indice >= 0) {
            siguientes[indice] = combinarAnuncios(
              anteriores[indice],
              dispositivo,
            );
          } else {
            siguientes.push(dispositivo);
          }
          return siguientes.sort(
            (izquierda, derecha) =>
              (derecha.rssi ?? -999) - (izquierda.rssi ?? -999),
          );
        });
      },
      error => {
        establecerEstadoConexion('error');
        agregarRegistro('error', `Error de búsqueda: ${error.message}`);
      },
      () => {
        establecerEstadoConexion(
          dispositivoRef.current ? 'conectado' : 'listo',
        );
        agregarRegistro(
          'informacion',
          'Búsqueda terminada tras 12 segundos. Puedes repetirla.',
        );
      },
    );
  }, [agregarRegistro, prepararBluetooth, servicioBle]);

  const detenerEscaneo = useCallback(() => {
    servicioBle.detenerEscaneo();
    establecerEstadoConexion(dispositivoRef.current ? 'conectado' : 'listo');
    agregarRegistro('informacion', 'Búsqueda BLE detenida.');
  }, [agregarRegistro, servicioBle]);

  const conectar = useCallback(
    async (
      dispositivo: InformacionDispositivoBle,
    ): Promise<ResultadoConexionEscaner> => {
      if (bloqueoConexion.current) {
        throw new Error('Ya existe una conexión en curso.');
      }
      bloqueoConexion.current = true;
      establecerConexionEnCurso(true);
      const version = ++versionConexion.current;
      try {
        if (!(await prepararBluetooth())) {
          throw new Error('Bluetooth no está disponible para conectar.');
        }
        servicioBle.detenerEscaneo();
        servicioElm.cancelarSuscripcion();
        suscripcionDesconexion.current?.remove();
        suscripcionDesconexion.current = null;
        if (dispositivoRef.current) {
          await servicioBle.desconectar();
        }
        limpiarSeleccion();
        establecerEstadoConexion('conectando');
        establecerIdDispositivoSeleccionado(dispositivo.id);
        agregarRegistro(
          'informacion',
          `Conectando con ${nombreDispositivo(dispositivo)} (${dispositivo.id})…`,
        );
        const descubrimiento = await servicioBle.conectarYDescubrir(
          dispositivo.id,
        );
        if (version !== versionConexion.current) {
          await servicioBle.desconectar();
          throw new Error('La conexión fue reemplazada por una operación nueva.');
        }
        const dispositivoActual: InformacionDispositivoBle = {
          ...dispositivo,
          id: descubrimiento.dispositivo.id,
          nombre: descubrimiento.dispositivo.name ?? dispositivo.nombre,
          nombreLocal:
            descubrimiento.dispositivo.localName ?? dispositivo.nombreLocal,
          rssi: descubrimiento.dispositivo.rssi ?? dispositivo.rssi,
        };
        dispositivoRef.current = dispositivoActual;
        establecerDispositivoConectado(dispositivoActual);
        establecerCaracteristicas(descubrimiento.caracteristicas);
        establecerEstadoConexion('conectado');
        agregarRegistro(
          'exito',
          `Conectado. Se encontraron ${descubrimiento.caracteristicas.length} características GATT.`,
        );

        suscripcionDesconexion.current = servicioBle.observarDesconexion(
          dispositivoActual.id,
          error => {
            versionConexion.current += 1;
            servicioElm.cancelarSuscripcion();
            suscripcionDesconexion.current?.remove();
            suscripcionDesconexion.current = null;
            limpiarSeleccion();
            establecerEstadoConexion('desconectado');
            agregarRegistro(
              error ? 'error' : 'informacion',
              error
                ? `Desconexión BLE: ${error.message}`
                : 'El dispositivo se desconectó.',
            );
          },
        );
        return {
          dispositivo: dispositivoActual,
          caracteristicas: descubrimiento.caracteristicas,
        };
      } catch (capturado) {
        await servicioBle.desconectar().catch(() => undefined);
        limpiarSeleccion();
        establecerEstadoConexion('error');
        agregarRegistro('error', mensajeError(capturado));
        throw capturado;
      } finally {
        bloqueoConexion.current = false;
        establecerConexionEnCurso(false);
      }
    },
    [
      agregarRegistro,
      limpiarSeleccion,
      prepararBluetooth,
      servicioBle,
      servicioElm,
    ],
  );

  const desconectar = useCallback(async () => {
    if (bloqueoConexion.current) {
      return;
    }
    bloqueoConexion.current = true;
    establecerConexionEnCurso(true);
    versionConexion.current += 1;
    try {
      servicioElm.cancelarSuscripcion();
      suscripcionDesconexion.current?.remove();
      suscripcionDesconexion.current = null;
      await servicioBle.desconectar();
      limpiarSeleccion();
      establecerEstadoConexion('desconectado');
      agregarRegistro('informacion', 'Conexión cerrada por el usuario.');
    } catch (capturado) {
      establecerEstadoConexion('error');
      agregarRegistro('error', mensajeError(capturado));
      throw capturado;
    } finally {
      bloqueoConexion.current = false;
      establecerConexionEnCurso(false);
    }
  }, [agregarRegistro, limpiarSeleccion, servicioBle, servicioElm]);

  const cancelarSuscripcion = useCallback(() => {
    servicioElm.cancelarSuscripcion();
    establecerClaveSuscripcion(null);
  }, [servicioElm]);

  const elegirEscritura = useCallback(
    (elemento: InformacionCaracteristicaGatt) => {
      escrituraRef.current = elemento;
      establecerEscrituraSeleccionada(elemento);
      establecerMensajeVerificacion(
        'Canales modificados. Vuelve a verificar antes de guardarlos.',
      );
      agregarRegistro(
        'informacion',
        `Característica de escritura seleccionada: ${elemento.uuidCaracteristica}`,
      );
    },
    [agregarRegistro],
  );

  const elegirNotificacion = useCallback(
    (elemento: InformacionCaracteristicaGatt) => {
      cancelarSuscripcion();
      notificacionRef.current = elemento;
      establecerNotificacionSeleccionada(elemento);
      establecerMensajeVerificacion(
        'Canales modificados. Vuelve a verificar antes de guardarlos.',
      );
      agregarRegistro(
        'informacion',
        `Característica de notificación seleccionada: ${elemento.uuidCaracteristica}`,
      );
    },
    [agregarRegistro, cancelarSuscripcion],
  );

  const seleccionarCanales = useCallback(
    (
      escritura: InformacionCaracteristicaGatt,
      notificacion: InformacionCaracteristicaGatt,
    ) => {
      cancelarSuscripcion();
      escrituraRef.current = escritura;
      notificacionRef.current = notificacion;
      establecerEscrituraSeleccionada(escritura);
      establecerNotificacionSeleccionada(notificacion);
    },
    [cancelarSuscripcion],
  );

  const activarSuscripcion = useCallback(
    (notificacion?: InformacionCaracteristicaGatt): boolean => {
      const dispositivo = dispositivoRef.current;
      const canal = notificacion ?? notificacionRef.current;
      if (!dispositivo || !canal) {
        agregarRegistro(
          'error',
          'Conecta un dispositivo y selecciona un canal de notificación.',
        );
        return false;
      }
      servicioElm.suscribirse(dispositivo.id, canal, {
        alRecibirFragmento: (textoAscii, bytes) => {
          const hexadecimal = bytes
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join(' ')
            .toUpperCase();
          agregarRegistro(
            'rx',
            `RX ASCII: ${asciiVisible(textoAscii)} | bytes: ${hexadecimal}`,
          );
        },
        alOcurrirError: error => {
          establecerEstadoConexion('error');
          establecerClaveSuscripcion(null);
          agregarRegistro('error', `Error de notificación: ${error.message}`);
        },
      });
      establecerClaveSuscripcion(clavePara(canal));
      agregarRegistro(
        'exito',
        `Suscripción activa: ${canal.uuidCaracteristica}`,
      );
      return true;
    },
    [agregarRegistro, servicioElm],
  );

  const enviarComando = useCallback(
    async (comando: string, opciones: OpcionesEnvioEscaner = {}) => {
      const dispositivo = dispositivoRef.current;
      const escritura = opciones.escritura ?? escrituraRef.current;
      if (!dispositivo || !escritura) {
        throw new Error(
          'Conecta el escaner y selecciona un canal de escritura.',
        );
      }
      if (!servicioElm.estaSuscrito() && !activarSuscripcion()) {
        throw new Error('No se pudo activar el canal de notificación.');
      }
      agregarRegistro('tx', `TX ASCII: ${comando.trim().toUpperCase()}\\r`);
      return servicioElm.enviarComando(
        dispositivo.id,
        escritura,
        comando,
        opciones.tiempoEsperaMs,
      );
    },
    [activarSuscripcion, agregarRegistro, servicioElm],
  );

  const marcarError = useCallback(
    (mensaje: string) => {
      establecerEstadoConexion('error');
      agregarRegistro('error', mensaje);
    },
    [agregarRegistro],
  );

  const valor = useMemo<SesionEscanerObd>(
    () => ({
      estadoBluetooth,
      estadoConexion,
      dispositivos,
      idDispositivoSeleccionado,
      dispositivoConectado,
      caracteristicas,
      escrituraSeleccionada,
      notificacionSeleccionada,
      claveEscritura: escrituraSeleccionada
        ? clavePara(escrituraSeleccionada)
        : null,
      claveNotificacion: notificacionSeleccionada
        ? clavePara(notificacionSeleccionada)
        : null,
      claveSuscripcion,
      conexionEnCurso,
      mensajeVerificacion,
      entradasConsola,
      prepararBluetooth,
      iniciarEscaneo,
      detenerEscaneo,
      conectar,
      desconectar,
      elegirEscritura,
      elegirNotificacion,
      seleccionarCanales,
      activarSuscripcion,
      cancelarSuscripcion,
      enviarComando,
      estaSuscrito: () => servicioElm.estaSuscrito(),
      estaSincronizado: () => servicioElm.estaSincronizado(),
      conectado: () => dispositivoRef.current !== null,
      obtenerVersionConexion: () => versionConexion.current,
      establecerMensajeVerificacion,
      marcarError,
      marcarConectado: () => establecerEstadoConexion('conectado'),
      agregarRegistro,
      limpiarRegistros: () => establecerEntradasConsola([]),
    }),
    [
      activarSuscripcion,
      agregarRegistro,
      cancelarSuscripcion,
      caracteristicas,
      claveSuscripcion,
      conectar,
      conexionEnCurso,
      desconectar,
      detenerEscaneo,
      dispositivoConectado,
      dispositivos,
      elegirEscritura,
      elegirNotificacion,
      enviarComando,
      entradasConsola,
      escrituraSeleccionada,
      estadoBluetooth,
      estadoConexion,
      idDispositivoSeleccionado,
      iniciarEscaneo,
      marcarError,
      mensajeVerificacion,
      notificacionSeleccionada,
      prepararBluetooth,
      seleccionarCanales,
      servicioElm,
    ],
  );

  return (
    <ContextoEscanerObd.Provider value={valor}>
      {children}
    </ContextoEscanerObd.Provider>
  );
}

export function useSesionEscanerObd(): SesionEscanerObd {
  const contexto = useContext(ContextoEscanerObd);
  if (!contexto) {
    throw new Error(
      'useSesionEscanerObd debe usarse dentro de ProveedorEscanerObd.',
    );
  }
  return contexto;
}

function clavePara(elemento: InformacionCaracteristicaGatt): string {
  return `${elemento.uuidServicio}|${elemento.uuidCaracteristica}`;
}

function nombreDispositivo(dispositivo: InformacionDispositivoBle): string {
  return (
    dispositivo.nombre?.trim() ||
    dispositivo.nombreLocal?.trim() ||
    'Dispositivo sin nombre'
  );
}

function asciiVisible(texto: string): string {
  return texto.replace(/\r/g, '↵').replace(/\n/g, '⏎');
}

function mensajeError(capturado: unknown): string {
  return capturado instanceof Error ? capturado.message : String(capturado);
}
