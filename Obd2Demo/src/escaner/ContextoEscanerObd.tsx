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
  esBluetoothUtilizable,
  ServicioBle,
  type EstadoPermisosBluetooth,
} from './ServicioBle';
import { combinarAnuncios } from './PerfilesEscaner';
import { useEscaneresGuardados } from './usarEscaneresGuardados';
import {
  identificarElm,
  verificarCanalesElm,
} from './VerificacionElm';
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
  const escaneres = useEscaneresGuardados();
  const { buscar: buscarGuardado, guardar: guardarEscaner } = escaneres;
  const [estadoPermisos, establecerEstadoPermisos] =
    useState<EstadoPermisosBluetooth>('pendientes');
  const [estadoPreparacion, establecerEstadoPreparacion] =
    useState<SesionEscanerObd['estadoPreparacion']>('sin-verificar');
  const [advertenciaGuardado, establecerAdvertenciaGuardado] = useState<
    string | null
  >(null);
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
  const [claveSuscripcion, establecerClaveSuscripcion] = useState<
    string | null
  >(null);
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
  const cierreEnCurso = useRef(false);
  const suscripcionDesconexion = useRef<Subscription | null>(null);
  const bloqueoPreparacion = useRef(false);
  const versionPreparacion = useRef(0);
  const versionBusqueda = useRef(0);
  const bluetoothRef = useRef(State.Unknown);
  const permisosRef = useRef<EstadoPermisosBluetooth>('pendientes');
  const caracteristicasRef = useRef<InformacionCaracteristicaGatt[]>([]);
  const verificacionRef = useRef<{
    version: number;
    escritura: string;
    notificacion: string;
  } | null>(null);

  const invalidarVerificacion = useCallback(() => {
    verificacionRef.current = null;
    establecerEstadoPreparacion('sin-verificar');
    establecerAdvertenciaGuardado(null);
  }, []);

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
    invalidarVerificacion();
    caracteristicasRef.current = [];
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
  }, [invalidarVerificacion]);

  const cancelarRecepcion = useCallback(() => {
    // cierro los dos observadores sin cambiar los bloqueos de la conexion
    servicioElm.cancelarSuscripcion();
    suscripcionDesconexion.current?.remove();
    suscripcionDesconexion.current = null;
  }, [servicioElm]);

  useEffect(() => {
    const suscripcionEstado = servicioBle.observarEstadoBluetooth(estado => {
      bluetoothRef.current = estado;
      establecerEstadoBluetooth(estado);
      if (!esBluetoothUtilizable(estado)) {
        versionPreparacion.current += 1;
        versionBusqueda.current += 1;
        servicioBle.detenerEscaneo();
        cancelarRecepcion();
        versionConexion.current += 1;
        limpiarSeleccion();
        establecerEstadoConexion('bluetooth-no-disponible');
        servicioBle.desconectar().catch(() => undefined);
      }
    });

    return () => {
      versionPreparacion.current += 1;
      versionBusqueda.current += 1;
      versionConexion.current += 1;
      suscripcionEstado.remove();
      suscripcionDesconexion.current?.remove();
      servicioElm.cancelarSuscripcion();
      servicioBle.destruir().catch(() => undefined);
    };
  }, [cancelarRecepcion, limpiarSeleccion, servicioBle, servicioElm]);

  const actualizarBluetooth = useCallback(
    async (solicitar = false): Promise<boolean> => {
      try {
        const permisos = await servicioBle.consultarPermisosAndroid(solicitar);
        permisosRef.current = permisos;
        establecerEstadoPermisos(permisos);
        if (permisos !== 'concedidos') {
          if (dispositivoRef.current) {
            versionPreparacion.current += 1;
            versionConexion.current += 1;
            versionBusqueda.current += 1;
            cancelarRecepcion();
            limpiarSeleccion();
            servicioBle.desconectar().catch(() => undefined);
          }
          establecerEstadoConexion('bluetooth-no-disponible');
          return false;
        }
        const estado = await servicioBle.obtenerEstadoBluetooth();
        bluetoothRef.current = estado;
        establecerEstadoBluetooth(estado);
        if (!esBluetoothUtilizable(estado)) {
          if (dispositivoRef.current) {
            versionPreparacion.current += 1;
            versionConexion.current += 1;
            cancelarRecepcion();
            limpiarSeleccion();
            servicioBle.desconectar().catch(() => undefined);
          }
          establecerEstadoConexion('bluetooth-no-disponible');
          agregarRegistro(
            'error',
            `Bluetooth no está listo: ${estado}. Enciéndelo e intenta otra vez.`,
          );
          return false;
        }
        agregarRegistro('exito', 'Permisos concedidos y Bluetooth encendido.');
        if (!dispositivoRef.current) {
          establecerEstadoConexion(anterior =>
            anterior === 'buscando' || anterior === 'conectando'
              ? anterior
              : 'listo',
          );
        }
        return true;
      } catch (capturado) {
        const mensaje = mensajeError(capturado);
        establecerEstadoConexion('error');
        agregarRegistro('error', mensaje);
        return false;
      }
    },
    [agregarRegistro, cancelarRecepcion, limpiarSeleccion, servicioBle],
  );

  const prepararBluetooth = useCallback(
    () => actualizarBluetooth(true),
    [actualizarBluetooth],
  );

  const iniciarEscaneo = useCallback(async () => {
    if (
      bloqueoConexion.current ||
      bloqueoPreparacion.current ||
      cierreEnCurso.current
    )
      return;
    const version = ++versionBusqueda.current;
    if (
      !(await prepararBluetooth()) ||
      version !== versionBusqueda.current ||
      bloqueoConexion.current ||
      bloqueoPreparacion.current
    ) {
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
    versionBusqueda.current += 1;
    servicioBle.detenerEscaneo();
    establecerEstadoConexion(
      esBluetoothUtilizable(bluetoothRef.current)
        ? dispositivoRef.current
          ? 'conectado'
          : 'listo'
        : 'bluetooth-no-disponible',
    );
    agregarRegistro('informacion', 'Búsqueda BLE detenida.');
  }, [agregarRegistro, servicioBle]);

  const conectar = useCallback(
    async (
      dispositivo: InformacionDispositivoBle,
      interno = false,
    ): Promise<ResultadoConexionEscaner> => {
      if (
        bloqueoConexion.current ||
        cierreEnCurso.current ||
        (bloqueoPreparacion.current && !interno)
      ) {
        throw new Error('Ya existe una conexión en curso.');
      }
      bloqueoConexion.current = true;
      establecerConexionEnCurso(true);
      const version = ++versionConexion.current;
      versionBusqueda.current += 1;
      invalidarVerificacion();
      if (interno) establecerEstadoPreparacion('conectando');
      try {
        if (!(await prepararBluetooth())) {
          throw new Error('Bluetooth no está disponible para conectar.');
        }
        if (version !== versionConexion.current)
          throw new Error('Conexión cancelada.');
        servicioBle.detenerEscaneo();
        cancelarRecepcion();
        if (dispositivoRef.current) {
          await servicioBle.desconectar();
        }
        if (version !== versionConexion.current)
          throw new Error('Conexión cancelada.');
        limpiarSeleccion();
        establecerEstadoConexion('conectando');
        establecerIdDispositivoSeleccionado(dispositivo.id);
        agregarRegistro(
          'informacion',
          `Conectando con ${nombreDispositivo(dispositivo)} (${
            dispositivo.id
          })…`,
        );
        const descubrimiento = await servicioBle.conectarYDescubrir(
          dispositivo.id,
        );
        if (version !== versionConexion.current) {
          await servicioBle.desconectar();
          throw new Error(
            'La conexión fue reemplazada por una operación nueva.',
          );
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
        caracteristicasRef.current = descubrimiento.caracteristicas;
        establecerEstadoConexion('conectado');
        agregarRegistro(
          'exito',
          `Conectado. Se encontraron ${descubrimiento.caracteristicas.length} características GATT.`,
        );

        suscripcionDesconexion.current = servicioBle.observarDesconexion(
          dispositivoActual.id,
          error => {
            if (version !== versionConexion.current) return;
            versionPreparacion.current += 1;
            versionConexion.current += 1;
            cancelarRecepcion();
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
        if (version === versionConexion.current) {
          limpiarSeleccion();
          establecerEstadoConexion('error');
          agregarRegistro('error', mensajeError(capturado));
        }
        throw capturado;
      } finally {
        bloqueoConexion.current = false;
        if (!cierreEnCurso.current) establecerConexionEnCurso(false);
      }
    },
    [
      agregarRegistro,
      cancelarRecepcion,
      limpiarSeleccion,
      invalidarVerificacion,
      prepararBluetooth,
      servicioBle,
    ],
  );

  const desconectar = useCallback(async () => {
    if (cierreEnCurso.current) return;
    cierreEnCurso.current = true;
    establecerConexionEnCurso(true);
    versionPreparacion.current += 1;
    versionBusqueda.current += 1;
    versionConexion.current += 1;
    limpiarSeleccion();
    try {
      cancelarRecepcion();
      await servicioBle.desconectar();
      establecerEstadoConexion('desconectado');
      agregarRegistro('informacion', 'Conexión cerrada por el usuario.');
    } catch (capturado) {
      establecerEstadoConexion('error');
      agregarRegistro('error', mensajeError(capturado));
      throw capturado;
    } finally {
      cierreEnCurso.current = false;
      if (!bloqueoConexion.current) establecerConexionEnCurso(false);
    }
  }, [agregarRegistro, cancelarRecepcion, limpiarSeleccion, servicioBle]);

  const cancelarSuscripcion = useCallback(() => {
    invalidarVerificacion();
    servicioElm.cancelarSuscripcion();
    establecerClaveSuscripcion(null);
  }, [invalidarVerificacion, servicioElm]);

  const elegirEscritura = useCallback(
    (elemento: InformacionCaracteristicaGatt) => {
      invalidarVerificacion();
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
    [agregarRegistro, invalidarVerificacion],
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
          invalidarVerificacion();
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
    [agregarRegistro, invalidarVerificacion, servicioElm],
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

  const estaPreparado = useCallback(() => {
    const verificacion = verificacionRef.current;
    return Boolean(
      verificacion &&
        dispositivoRef.current &&
        bluetoothRef.current === State.PoweredOn &&
        permisosRef.current === 'concedidos' &&
        verificacion.version === versionConexion.current &&
        escrituraRef.current &&
        notificacionRef.current &&
        verificacion.escritura === clavePara(escrituraRef.current) &&
        verificacion.notificacion === clavePara(notificacionRef.current) &&
        servicioElm.estaSuscrito() &&
        servicioElm.estaSincronizado(),
    );
  }, [servicioElm]);

  const confirmarVerificacion = useCallback(
    (
      respuesta: string,
      version: number,
      escritura: InformacionCaracteristicaGatt,
      notificacion: InformacionCaracteristicaGatt,
    ): boolean => {
      if (
        !identificarElm(respuesta) ||
        !dispositivoRef.current ||
        version !== versionConexion.current ||
        bluetoothRef.current !== State.PoweredOn ||
        permisosRef.current !== 'concedidos' ||
        !servicioElm.estaSuscrito() ||
        !escrituraRef.current ||
        !notificacionRef.current ||
        clavePara(escritura) !== clavePara(escrituraRef.current) ||
        clavePara(notificacion) !== clavePara(notificacionRef.current)
      )
        return false;
      verificacionRef.current = {
        version,
        escritura: clavePara(escritura),
        notificacion: clavePara(notificacion),
      };
      establecerEstadoPreparacion('preparado');
      return true;
    },
    [servicioElm],
  );

  const prepararEscaner = useCallback(
    async (dispositivo?: InformacionDispositivoBle) => {
      if (
        bloqueoPreparacion.current ||
        bloqueoConexion.current ||
        cierreEnCurso.current
      ) {
        throw new Error('Ya existe una preparación del escáner en curso.');
      }
      bloqueoPreparacion.current = true;
      const operacion = ++versionPreparacion.current;
      const vigente = () => operacion === versionPreparacion.current;
      invalidarVerificacion();
      try {
        if (dispositivo) await conectar(dispositivo, true);
        if (!vigente()) throw new Error('Preparación cancelada.');
        const actual = dispositivoRef.current;
        if (!actual)
          throw new Error('Conecta un escáner antes de verificarlo.');
        const version = versionConexion.current;
        const sigueVigente = () =>
          vigente() &&
          version === versionConexion.current &&
          bluetoothRef.current === State.PoweredOn &&
          dispositivoRef.current?.id === actual.id;
        establecerEstadoPreparacion('verificando');
        const resultado = await verificarCanalesElm(
          actual,
          caracteristicasRef.current,
          buscarGuardado(actual.id),
          {
            sigueVigente,
            alIntentar: mensaje => {
              establecerMensajeVerificacion(mensaje);
              agregarRegistro('informacion', mensaje);
            },
            probar: async canales => {
              seleccionarCanales(canales.escritura, canales.notificacion);
              establecerEstadoPreparacion('verificando');
              if (!activarSuscripcion(canales.notificacion))
                throw new Error('No se pudo activar la recepción.');
              return (
                await enviarComando('ATI', {
                  escritura: canales.escritura,
                  tiempoEsperaMs: 5000,
                })
              ).textoAscii;
            },
          },
        );
        if (
          !sigueVigente() ||
          !confirmarVerificacion(
            resultado.respuestaAti,
            version,
            resultado.canales.escritura,
            resultado.canales.notificacion,
          )
        )
          throw new Error('La conexión o sus canales cambiaron durante ATI.');
        // si el telefono falla al guardar, la comprobacion del enlace sigue siendo valida
        let advertencia: string | null = null;
        try {
          await guardarEscaner(resultado.registro);
        } catch {
          advertencia =
            'Escáner conectado. No se pudo guardar para próximas conexiones.';
          if (sigueVigente()) establecerAdvertenciaGuardado(advertencia);
        }
        if (!sigueVigente() || !estaPreparado())
          throw new Error('Preparación cancelada.');
        establecerMensajeVerificacion(
          `Escáner preparado: ${resultado.registro.identificacionElm}.`,
        );
        establecerEstadoConexion('conectado');
        agregarRegistro(
          'exito',
          `ATI verificado: ${resultado.registro.identificacionElm}.`,
        );
        return advertencia;
      } catch (capturado) {
        if (vigente()) {
          cancelarSuscripcion();
          establecerEstadoPreparacion('error');
          establecerMensajeVerificacion(mensajeError(capturado));
          agregarRegistro('error', mensajeError(capturado));
        }
        throw capturado;
      } finally {
        bloqueoPreparacion.current = false;
      }
    },
    [
      activarSuscripcion,
      agregarRegistro,
      buscarGuardado,
      cancelarSuscripcion,
      confirmarVerificacion,
      conectar,
      enviarComando,
      estaPreparado,
      guardarEscaner,
      invalidarVerificacion,
      seleccionarCanales,
    ],
  );

  const conectarYVerificar = useCallback(
    (dispositivo: InformacionDispositivoBle) => prepararEscaner(dispositivo),
    [prepararEscaner],
  );
  const verificarCanalesAutomaticamente = useCallback(
    () => prepararEscaner(),
    [prepararEscaner],
  );

  const valor = useMemo<SesionEscanerObd>(
    () => ({
      estadoPermisos,
      estadoPreparacion,
      advertenciaGuardado,
      escaneresGuardados: escaneres.guardados,
      cargandoGuardados: escaneres.cargando,
      errorGuardados: escaneres.error,
      actualizarBluetooth,
      conectarYVerificar,
      verificarCanalesAutomaticamente,
      cancelarPreparacion: desconectar,
      confirmarVerificacion,
      estaPreparado,
      guardarEscaner,
      olvidarEscaner: escaneres.olvidar,
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
      estadoPermisos,
      estadoPreparacion,
      advertenciaGuardado,
      escaneres.guardados,
      escaneres.cargando,
      escaneres.error,
      escaneres.olvidar,
      actualizarBluetooth,
      conectarYVerificar,
      verificarCanalesAutomaticamente,
      confirmarVerificacion,
      estaPreparado,
      guardarEscaner,
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
