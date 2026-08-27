import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { State, type Subscription } from 'react-native-ble-plx';
import {
  esBluetoothNoDisponible,
  esBluetoothUtilizable,
  ServicioBle,
} from '../ble/ServicioBle';
import {
  analizarRespuestaObd,
  type AnalisisRespuestaObd,
  type DiagnosticoLineaObd,
} from '../obd/AnalisisRespuestaObd';
import { calcularMetricasFlujoObd } from '../obd/MetricasFlujoObd';
import { ServicioElm327, traducirRespuestaObd } from '../obd/ServicioElm327';
import type {
  EntradaConsola,
  EstadoConexion,
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
  MetricasFlujoObd,
  ResultadoJsonObd,
} from '../tipos/ble';
import { obtenerTiempoMs } from '../utilidades/medicionTiempo';

// secuencia minima recomendada para dejar ELM327 en un formato de respuesta
// predecible: sin eco ni saltos de linea, con espacios para diagnostico,
// sin cabeceras y con protocolo automatico.
const COMANDOS_INICIALIZACION = [
  'ATZ',
  'ATE0',
  'ATL0',
  'ATS1',
  'ATH0',
  'ATSP0',
];

const ETIQUETAS_ESTADO: Record<EstadoConexion, string> = {
  listo: 'Listo',
  'bluetooth-no-disponible': 'Bluetooth no disponible',
  buscando: 'Buscando',
  conectando: 'Conectando',
  conectado: 'Conectado',
  desconectado: 'Desconectado',
  error: 'Error',
};

/**
 * interfaz de la demo.
 *
 * Coordina tres responsabilidades ya separadas:
 * - ServicioBle: permisos, escaneo, conexion y GATT.
 * - ServicioElm327: comandos ASCII y respuestas fragmentadas.
 * - React: estado visible, seleccion manual, consola y JSON.
 */
export function PantallaEscanerObd() {
  // Los servicios se crean una sola vez para conservar el BleManager y sus
  // suscripciones aunque React vuelva a renderizar la pantalla.
  const [servicioBle] = useState(() => new ServicioBle());
  const [servicioElm] = useState(() => new ServicioElm327(servicioBle));

  // Estado de Bluetooth, busqueda, conexion e inventario GATT.
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

  // Las claves combinan UUID de servicio y caracteristica. Esto evita colisiones
  // si dos servicios exponen el mismo UUID de caracteristica.
  const [claveEscritura, establecerClaveEscritura] = useState<string | null>(
    null,
  );
  const [claveNotificacion, establecerClaveNotificacion] = useState<
    string | null
  >(null);
  const [claveSuscripcion, establecerClaveSuscripcion] = useState<
    string | null
  >(null);
  const [entradasConsola, establecerEntradasConsola] = useState<
    EntradaConsola[]
  >([]);
  const [resultadoJsonVisible, establecerResultadoJsonVisible] = useState<
    string | null
  >(null);
  const [ultimasMetricas, establecerUltimasMetricas] =
    useState<MetricasFlujoObd | null>(null);
  const [ultimoAnalisis, establecerUltimoAnalisis] =
    useState<AnalisisRespuestaObd | null>(null);
  const [comandoEnCurso, establecerComandoEnCurso] = useState(false);

  // las suscripciones y el contador no necesitan provocar renderizados.
  const suscripcionDesconexion = useRef<Subscription | null>(null);
  const secuenciaRegistro = useRef(0);

  // conserva como maximo 200 eventos para que una sesion larga no crezca sin
  // limite en memoria. Cada entrada tiene un id estable para renderizar la lista.
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

  // observa el estado nativo de Bluetooth durante toda la vida de la pantalla.
  // el retorno del efecto es la limpieza central de recursos BLE y ELM327.
  useEffect(() => {
    const suscripcionEstado = servicioBle.observarEstadoBluetooth(estado => {
      establecerEstadoBluetooth(estado);
      if (esBluetoothNoDisponible(estado) || estado === State.PoweredOff) {
        establecerEstadoConexion('bluetooth-no-disponible');
      }
    });

    return () => {
      suscripcionEstado.remove();
      suscripcionDesconexion.current?.remove();
      servicioElm.cancelarSuscripcion();
      servicioBle.destruir().catch(() => undefined);
    };
  }, [servicioBle, servicioElm]);

  // GATT no indica cual canal pertenece a ELM327. Se muestran como candidatos
  // todas las caracteristicas que tecnicamente permiten TX o RX.
  const candidatasEscritura = useMemo(
    () =>
      caracteristicas.filter(
        elemento =>
          elemento.permiteEscrituraConRespuesta ||
          elemento.permiteEscrituraSinRespuesta,
      ),
    [caracteristicas],
  );
  const candidatasNotificacion = useMemo(
    () =>
      caracteristicas.filter(
        elemento => elemento.permiteNotificacion || elemento.permiteIndicacion,
      ),
    [caracteristicas],
  );
  const escrituraSeleccionada =
    candidatasEscritura.find(
      elemento => clavePara(elemento) === claveEscritura,
    ) ?? null;
  const notificacionSeleccionada =
    candidatasNotificacion.find(
      elemento => clavePara(elemento) === claveNotificacion,
    ) ?? null;

  /** Solicita permisos y confirma que Bluetooth este encendido. */
  async function prepararBluetooth(): Promise<boolean> {
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
      if (!dispositivoConectado) {
        establecerEstadoConexion('listo');
      }
      return true;
    } catch (capturado) {
      informarError(capturado);
      return false;
    }
  }

  /** Inicia un escaneo nuevo y elimina duplicados usando el id del dispositivo. */
  async function iniciarEscaneo() {
    if (!(await prepararBluetooth())) {
      return;
    }
    establecerDispositivos([]);
    establecerIdDispositivoSeleccionado(null);
    establecerEstadoConexion('buscando');
    agregarRegistro('informacion', 'Búsqueda BLE iniciada.');
    servicioBle.iniciarEscaneo(
      dispositivo => {
        establecerDispositivos(anteriores => {
          const indiceExistente = anteriores.findIndex(
            elemento => elemento.id === dispositivo.id,
          );
          const siguientes = [...anteriores];
          if (indiceExistente >= 0) {
            siguientes[indiceExistente] = dispositivo;
          } else {
            siguientes.push(dispositivo);
          }
          // Los dispositivos con mejor senal se muestran primero.
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
    );
  }

  /** Detiene manualmente el escaneo y restaura el estado visible. */
  function detenerEscaneo() {
    servicioBle.detenerEscaneo();
    if (estadoConexion === 'buscando') {
      establecerEstadoConexion(dispositivoConectado ? 'conectado' : 'listo');
    }
    agregarRegistro('informacion', 'Búsqueda BLE detenida.');
  }

  /**
   * Conecta el dispositivo seleccionado, descubre GATT y arma su inventario.
   * Si ya existia otra conexion, se cierra antes de abrir la nueva.
   */
  async function conectar(dispositivo: InformacionDispositivoBle) {
    try {
      servicioBle.detenerEscaneo();
      servicioElm.cancelarSuscripcion();
      establecerClaveSuscripcion(null);
      if (dispositivoConectado) {
        suscripcionDesconexion.current?.remove();
        suscripcionDesconexion.current = null;
        await servicioBle.desconectar();
        establecerDispositivoConectado(null);
      }
      establecerEstadoConexion('conectando');
      establecerIdDispositivoSeleccionado(dispositivo.id);
      agregarRegistro(
        'informacion',
        `Conectando con ${mostrarNombreDispositivo(dispositivo)} (${
          dispositivo.id
        })…`,
      );
      const descubrimiento = await servicioBle.conectarYDescubrir(
        dispositivo.id,
      );
      const dispositivoActual: InformacionDispositivoBle = {
        id: descubrimiento.dispositivo.id,
        nombre: descubrimiento.dispositivo.name ?? dispositivo.nombre,
        nombreLocal:
          descubrimiento.dispositivo.localName ?? dispositivo.nombreLocal,
        rssi: descubrimiento.dispositivo.rssi ?? dispositivo.rssi,
      };
      establecerDispositivoConectado(dispositivoActual);
      establecerCaracteristicas(descubrimiento.caracteristicas);
      establecerClaveEscritura(null);
      establecerClaveNotificacion(null);
      establecerEstadoConexion('conectado');
      agregarRegistro(
        'exito',
        `Conectado. Se encontraron ${descubrimiento.caracteristicas.length} características GATT.`,
      );

      suscripcionDesconexion.current?.remove();
      // Esta suscripcion tambien detecta desconexiones fisicas inesperadas.
      suscripcionDesconexion.current = servicioBle.observarDesconexion(
        dispositivo.id,
        error => {
          servicioElm.cancelarSuscripcion();
          establecerClaveSuscripcion(null);
          establecerDispositivoConectado(null);
          establecerEstadoConexion('desconectado');
          agregarRegistro(
            error ? 'error' : 'informacion',
            error
              ? `Desconexión BLE: ${error.message}`
              : 'El dispositivo se desconectó.',
          );
        },
      );
    } catch (capturado) {
      await servicioBle.desconectar().catch(() => undefined);
      informarError(capturado);
    }
  }

  /** Cancela suscripciones antes de cerrar la conexion BLE. */
  async function desconectar() {
    try {
      servicioElm.cancelarSuscripcion();
      establecerClaveSuscripcion(null);
      suscripcionDesconexion.current?.remove();
      suscripcionDesconexion.current = null;
      await servicioBle.desconectar();
      establecerDispositivoConectado(null);
      establecerEstadoConexion('desconectado');
      agregarRegistro('informacion', 'Conexión cerrada por el usuario.');
    } catch (capturado) {
      informarError(capturado);
    }
  }

  /** Guarda la caracteristica elegida para enviar comandos. */
  function elegirEscritura(elemento: InformacionCaracteristicaGatt) {
    establecerClaveEscritura(clavePara(elemento));
    agregarRegistro(
      'informacion',
      `Característica de escritura seleccionada: ${elemento.uuidCaracteristica}`,
    );
  }

  /**
   * Cambia la caracteristica RX. La suscripcion anterior debe cancelarse porque
   * monitorCharacteristicForDevice queda ligado al UUID anterior.
   */
  function elegirNotificacion(elemento: InformacionCaracteristicaGatt) {
    servicioElm.cancelarSuscripcion();
    establecerClaveSuscripcion(null);
    establecerClaveNotificacion(clavePara(elemento));
    agregarRegistro(
      'informacion',
      `Característica de notificación seleccionada: ${elemento.uuidCaracteristica}`,
    );
  }

  /**
   * Activa notificaciones RX y registra cada fragmento como ASCII y hexadecimal.
   * La union de fragmentos hasta ">" se realiza dentro de ServicioElm327.
   */
  function suscribirseANotificaciones(): boolean {
    if (!dispositivoConectado || !notificacionSeleccionada) {
      agregarRegistro(
        'error',
        'Selecciona un dispositivo y una característica de notificación.',
      );
      return false;
    }
    const claveSeleccionada = clavePara(notificacionSeleccionada);
    servicioElm.suscribirse(dispositivoConectado.id, notificacionSeleccionada, {
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
    establecerClaveSuscripcion(claveSeleccionada);
    agregarRegistro(
      'exito',
      `Suscripción activa: ${notificacionSeleccionada.uuidCaracteristica}`,
    );
    return true;
  }

  /**
   * Ejecuta uno o varios comandos en orden. La inicializacion usa esta funcion
   * para no enviar el siguiente comando antes de recibir el prompt del anterior.
   */
  async function ejecutarComandos(comandos: readonly string[]) {
    if (comandoEnCurso) {
      return;
    }
    establecerComandoEnCurso(true);
    try {
      for (const comando of comandos) {
        const exitoso = await ejecutarComando(comando);
        if (!exitoso) {
          break;
        }
      }
    } finally {
      establecerComandoEnCurso(false);
    }
  }

  /**
   * Valida selecciones, prepara RX, envia un comando y construye el JSON final.
   * Devuelve false para detener una secuencia si ocurre cualquier error.
   */
  async function ejecutarComando(comando: string): Promise<boolean> {
    if (
      !dispositivoConectado ||
      !escrituraSeleccionada ||
      !notificacionSeleccionada
    ) {
      const mensaje =
        'Conecta el adaptador y selecciona características de escritura y notificación.';
      agregarRegistro('error', mensaje);
      establecerResultadoError(comando, mensaje);
      return false;
    }
    const claveSeleccionNotificacion = clavePara(notificacionSeleccionada);
    if (
      claveSuscripcion !== claveSeleccionNotificacion &&
      !suscribirseANotificaciones()
    ) {
      return false;
    }

    agregarRegistro('tx', `TX ASCII: ${comando.toUpperCase()}\\r`);
    establecerUltimasMetricas(null);
    try {
      const respuesta = await servicioElm.enviarComando(
        dispositivoConectado.id,
        escrituraSeleccionada,
        comando,
      );
      // La traduccion nunca reemplaza la respuesta cruda: ambas se guardan.
      const inicioTraduccionMs = obtenerTiempoMs();
      const analisis = analizarRespuestaObd(comando, respuesta.textoAscii);
      const traduccion = traducirRespuestaObd(comando, respuesta.textoAscii);
      const traduccionCompletaMs = obtenerTiempoMs();
      const erroresComunicacion = traduccion.error ? [traduccion.error] : [];
      const resultado: ResultadoJsonObd = {
        fecha: new Date().toISOString(),
        dispositivo: {
          nombre: mostrarNombreDispositivo(dispositivoConectado),
          identificador: dispositivoConectado.id,
        },
        comando: comando,
        respuestaCruda: respuesta.textoAscii,
        datoTraducido: traduccion.valor,
        unidad: traduccion.unidad,
        erroresComunicacion: erroresComunicacion,
      };
      const resultadoConstruidoMs = obtenerTiempoMs();
      const resultadoSerializado = JSON.stringify(resultado, null, 2);
      const jsonCompletoMs = obtenerTiempoMs();
      const metricas = calcularMetricasFlujoObd(
        comando,
        respuesta.metricasRecepcion,
        {
          inicioTraduccionMs,
          traduccionCompletaMs,
          resultadoConstruidoMs,
          jsonCompletoMs,
        },
      );
      establecerResultadoJsonVisible(resultadoSerializado);
      establecerUltimasMetricas(metricas);
      establecerUltimoAnalisis(analisis);
      agregarRegistro(
        'informacion',
        `Flujo ${metricas.comando}: respuesta ${formatearMilisegundos(
          metricas.respuestaCompletaMs,
        )}, traducción ${formatearMilisegundos(
          metricas.traduccionObdMs,
        )}, total ${formatearMilisegundos(metricas.totalHastaJsonMs)}.`,
      );
      agregarRegistro(
        traduccion.error ? 'error' : 'exito',
        traduccion.error ?? `Respuesta completa recibida para ${comando}.`,
      );
      if (estadoConexion === 'error') {
        establecerEstadoConexion('conectado');
      }
      return true;
    } catch (capturado) {
      const error = convertirAError(capturado);
      establecerEstadoConexion('error');
      agregarRegistro('error', `${comando}: ${error.message}`);
      establecerResultadoError(comando, error.message);
      return false;
    }
  }

  /** Crea un resultado JSON incluso cuando no se recibio respuesta. */
  function establecerResultadoError(comando: string, mensaje: string) {
    const resultado: ResultadoJsonObd = {
      fecha: new Date().toISOString(),
      dispositivo: dispositivoConectado
        ? {
            nombre: mostrarNombreDispositivo(dispositivoConectado),
            identificador: dispositivoConectado.id,
          }
        : null,
      comando: comando,
      respuestaCruda: null,
      datoTraducido: null,
      unidad: null,
      erroresComunicacion: [mensaje],
    };
    establecerResultadoJsonVisible(JSON.stringify(resultado, null, 2));
    establecerUltimasMetricas(null);
    establecerUltimoAnalisis(null);
  }

  /** Genera un reporte de texto que conserva exactamente la captura recibida. */
  async function compartirCapturaDiagnostico(): Promise<void> {
    if (!ultimoAnalisis) {
      return;
    }

    const lineas = ultimoAnalisis.lineas
      .map(linea => {
        const dtc =
          linea.codigosDtc.length > 0 ? linea.codigosDtc.join(', ') : 'ninguno';
        const advertencias =
          linea.advertencias.length > 0
            ? linea.advertencias.join(' | ')
            : 'ninguna';
        return [
          `Linea ${linea.numero}: ${linea.texto}`,
          `Cabecera: ${linea.cabecera ?? 'sin cabecera visible'}`,
          `Bytes OBD: ${linea.bytesObd.join(' ') || 'ninguno'}`,
          `Tipo: ${linea.tipo}`,
          `DTC: ${dtc}`,
          `Advertencias: ${advertencias}`,
        ].join('\n');
      })
      .join('\n\n');
    const metricas = ultimasMetricas
      ? [
          `Respuesta completa: ${formatearMilisegundos(
            ultimasMetricas.respuestaCompletaMs,
          )}`,
          `Traduccion OBD: ${formatearMilisegundos(
            ultimasMetricas.traduccionObdMs,
          )}`,
          `Total hasta JSON: ${formatearMilisegundos(
            ultimasMetricas.totalHastaJsonMs,
          )}`,
          `Fragmentos: ${ultimasMetricas.cantidadFragmentos}`,
          `Bytes BLE: ${ultimasMetricas.cantidadBytes}`,
        ].join('\n')
      : 'Sin metricas disponibles.';
    const reporte = [
      'SMARTOBD - CAPTURA DE DIAGNOSTICO',
      `Fecha del reporte: ${new Date().toISOString()}`,
      `Dispositivo: ${
        dispositivoConectado
          ? `${mostrarNombreDispositivo(dispositivoConectado)} (${
              dispositivoConectado.id
            })`
          : 'ninguno'
      }`,
      `Comando: ${ultimoAnalisis.comando}`,
      '',
      'RESPUESTA CRUDA ESCAPADA',
      ultimoAnalisis.respuestaEscapada,
      '',
      'LINEAS OBD',
      lineas || 'Sin lineas.',
      '',
      'DTC CONSOLIDADOS',
      ultimoAnalisis.codigosDtc.join(', ') || 'ninguno',
      '',
      'ADVERTENCIAS',
      ultimoAnalisis.advertencias.join('\n') || 'ninguna',
      '',
      'METRICAS',
      metricas,
      '',
      'RESULTADO JSON',
      resultadoJsonVisible ?? 'sin resultado',
    ].join('\n');

    try {
      await Share.share({
        title: `Captura SmartOBD ${ultimoAnalisis.comando}`,
        message: reporte,
      });
    } catch (capturado) {
      agregarRegistro(
        'error',
        `No se pudo compartir la captura: ${
          convertirAError(capturado).message
        }`,
      );
    }
  }

  /** Normaliza errores desconocidos y los refleja en estado y consola. */
  function informarError(capturado: unknown) {
    const error = convertirAError(capturado);
    establecerEstadoConexion('error');
    agregarRegistro('error', error.message);
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenedor}>
      <Text style={estilos.titulo}>Demo ELM327 BLE</Text>
      <View style={estilos.tarjetaEstado}>
        <Text style={estilos.textoEstado}>
          Estado: {ETIQUETAS_ESTADO[estadoConexion]}
        </Text>
        <Text style={estilos.secundario}>Bluetooth: {estadoBluetooth}</Text>
        <Text style={estilos.secundario}>
          Dispositivo:{' '}
          {dispositivoConectado
            ? mostrarNombreDispositivo(dispositivoConectado)
            : 'ninguno'}
        </Text>
      </View>

      <Seccion titulo="1. Bluetooth y búsqueda">
        <View style={estilos.filaBotones}>
          <BotonAccion
            etiqueta="Permisos / comprobar"
            onPress={() => prepararBluetooth()}
          />
          <BotonAccion
            etiqueta="Buscar BLE"
            onPress={() => iniciarEscaneo()}
            disabled={estadoConexion === 'buscando'}
          />
          <BotonAccion
            etiqueta="Detener"
            onPress={detenerEscaneo}
            disabled={estadoConexion !== 'buscando'}
          />
          <BotonAccion
            etiqueta="Desconectar"
            onPress={() => desconectar()}
            disabled={!dispositivoConectado}
            peligro
          />
        </View>
        {dispositivos.length === 0 ? (
          <Text style={estilos.vacio}>
            No hay dispositivos encontrados todavía.
          </Text>
        ) : (
          dispositivos.map(dispositivo => (
            <Pressable
              accessibilityRole="button"
              key={dispositivo.id}
              onPress={() => conectar(dispositivo)}
              style={[
                estilos.tarjetaDispositivo,
                idDispositivoSeleccionado === dispositivo.id &&
                  estilos.tarjetaSeleccionada,
              ]}
            >
              <Text style={estilos.nombreDispositivo}>
                {mostrarNombreDispositivo(dispositivo)}
              </Text>
              <Text style={estilos.monoespaciado}>{dispositivo.id}</Text>
              <Text style={estilos.secundario}>
                RSSI: {dispositivo.rssi ?? 'sin dato'} dBm
              </Text>
            </Pressable>
          ))
        )}
      </Seccion>

      <Seccion titulo={`2. GATT (${caracteristicas.length})`}>
        {caracteristicas.length === 0 ? (
          <Text style={estilos.vacio}>
            Conecta un dispositivo para enumerar servicios y características.
          </Text>
        ) : (
          caracteristicas.map(elemento => (
            <View key={clavePara(elemento)} style={estilos.tarjetaGatt}>
              <Text style={estilos.monoespaciado}>
                Servicio: {elemento.uuidServicio}
              </Text>
              <Text style={estilos.monoespaciado}>
                Característica: {elemento.uuidCaracteristica}
              </Text>
              <Text style={estilos.propiedades}>
                Lectura {siNo(elemento.permiteLectura)} · Escritura con
                respuesta {siNo(elemento.permiteEscrituraConRespuesta)} · sin
                respuesta {siNo(elemento.permiteEscrituraSinRespuesta)} ·
                Notificación {siNo(elemento.permiteNotificacion)} · Indicación{' '}
                {siNo(elemento.permiteIndicacion)}
              </Text>
            </View>
          ))
        )}
      </Seccion>

      <Seccion titulo="3. Características ELM327">
        <Text style={estilos.etiqueta}>Candidatas para escritura</Text>
        <OpcionesCaracteristica
          candidatas={candidatasEscritura}
          claveSeleccionada={claveEscritura}
          alSeleccionar={elegirEscritura}
          mensajeVacio="No se detectaron características escribibles."
        />
        <Text style={estilos.etiqueta}>
          Candidatas para notificación o indicación
        </Text>
        <OpcionesCaracteristica
          candidatas={candidatasNotificacion}
          claveSeleccionada={claveNotificacion}
          alSeleccionar={elegirNotificacion}
          mensajeVacio="No se detectaron características notificables."
        />
        <BotonAccion
          etiqueta={
            claveSuscripcion ? 'Suscripción activa' : 'Suscribirse a RX'
          }
          onPress={suscribirseANotificaciones}
          disabled={
            !notificacionSeleccionada ||
            !dispositivoConectado ||
            claveSuscripcion === claveNotificacion
          }
        />
      </Seccion>

      <Seccion titulo="4. Comandos ELM327">
        <Text style={estilos.ayuda}>
          Cada comando se envía como ASCII más retorno de carro. Las respuestas
          se acumulan hasta el prompt &gt;.
        </Text>
        <View style={estilos.filaBotones}>
          <BotonAccion
            etiqueta="ATI"
            onPress={() => ejecutarComandos(['ATI'])}
            disabled={comandoEnCurso}
          />
          <BotonAccion
            etiqueta="ATZ"
            onPress={() => ejecutarComandos(['ATZ'])}
            disabled={comandoEnCurso}
          />
          <BotonAccion
            etiqueta="Cabeceras ON · ATH1"
            onPress={() => ejecutarComandos(['ATH1'])}
            disabled={comandoEnCurso}
          />
          <BotonAccion
            etiqueta="Inicializar ELM327"
            onPress={() => ejecutarComandos(COMANDOS_INICIALIZACION)}
            disabled={comandoEnCurso}
          />
          <BotonAccion
            etiqueta="RPM · 010C"
            onPress={() => ejecutarComandos(['010C'])}
            disabled={comandoEnCurso}
          />
          <BotonAccion
            etiqueta="Temperatura · 0105"
            onPress={() => ejecutarComandos(['0105'])}
            disabled={comandoEnCurso}
          />
          <BotonAccion
            etiqueta="DTC almacenados · 03"
            onPress={() => ejecutarComandos(['03'])}
            disabled={comandoEnCurso}
          />
        </View>
        <Text style={estilos.etiqueta}>Velocidad del flujo</Text>
        {ultimasMetricas ? (
          <View style={estilos.tarjetaMetricas}>
            <Text style={estilos.tituloMetricas}>
              Comando medido: {ultimasMetricas.comando}
            </Text>
            <FilaMetrica
              nombre="Escritura BLE"
              valor={ultimasMetricas.escrituraBleMs}
            />
            <FilaMetrica
              nombre="Hasta primer fragmento"
              valor={ultimasMetricas.latenciaPrimerFragmentoMs}
            />
            <FilaMetrica
              nombre="Recepción de fragmentos"
              valor={ultimasMetricas.recepcionFragmentosMs}
            />
            <FilaMetrica
              nombre="Respuesta completa"
              valor={ultimasMetricas.respuestaCompletaMs}
            />
            <FilaMetrica
              nombre="Traducción OBD"
              valor={ultimasMetricas.traduccionObdMs}
            />
            <FilaMetrica
              nombre="Construcción del resultado"
              valor={ultimasMetricas.construccionResultadoMs}
            />
            <FilaMetrica
              nombre="Serialización JSON"
              valor={ultimasMetricas.serializacionJsonMs}
            />
            <FilaMetrica
              nombre="Primer fragmento hasta JSON"
              valor={ultimasMetricas.desdePrimerFragmentoHastaJsonMs}
            />
            <FilaMetrica
              nombre="Total comando hasta JSON"
              valor={ultimasMetricas.totalHastaJsonMs}
              destacado
            />
            <Text style={estilos.detalleMetricas}>
              {ultimasMetricas.cantidadFragmentos} fragmentos ·{' '}
              {ultimasMetricas.cantidadBytes} bytes recibidos
            </Text>
          </View>
        ) : (
          <Text style={estilos.vacio}>
            Ejecuta un comando para medir el flujo completo.
          </Text>
        )}
        <Text style={estilos.etiqueta}>Diagnóstico de la respuesta</Text>
        {ultimoAnalisis ? (
          <View style={estilos.bloqueDiagnostico}>
            <Text style={estilos.ayuda}>
              Mantén presionada la respuesta para seleccionarla o comparte el
              reporte completo.
            </Text>
            <BotonAccion
              etiqueta="Compartir captura"
              onPress={() => compartirCapturaDiagnostico()}
              compacto
            />
            <Text style={estilos.subtituloDiagnostico}>
              Respuesta cruda con separadores visibles
            </Text>
            <Text selectable style={estilos.respuestaCrudaDiagnostico}>
              {ultimoAnalisis.respuestaEscapada}
            </Text>
            <Text style={estilos.subtituloDiagnostico}>
              Líneas OBD detectadas
            </Text>
            {ultimoAnalisis.lineas.length > 0 ? (
              ultimoAnalisis.lineas.map(linea => (
                <DetalleLineaObd
                  key={`${linea.numero}-${linea.texto}`}
                  linea={linea}
                />
              ))
            ) : (
              <Text style={estilos.vacio}>No se detectaron líneas.</Text>
            )}
            {ultimoAnalisis.advertencias.length > 0 && (
              <View style={estilos.advertenciasDiagnostico}>
                <Text style={estilos.tituloAdvertencias}>Advertencias</Text>
                {ultimoAnalisis.advertencias.map(advertencia => (
                  <Text key={advertencia} style={estilos.textoAdvertencia}>
                    • {advertencia}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text style={estilos.vacio}>
            Ejecuta un comando para analizar su respuesta completa.
          </Text>
        )}
        <Text style={estilos.etiqueta}>Resultado JSON</Text>
        <Text style={estilos.json}>
          {resultadoJsonVisible
            ? resultadoJsonVisible
            : 'Todavía no existe una respuesta real. Conecta el ELM327 y envía un comando.'}
        </Text>
      </Seccion>

      <Seccion titulo="5. Consola de eventos y errores">
        <View style={estilos.cabeceraConsola}>
          <Text style={estilos.ayuda}>{entradasConsola.length} eventos</Text>
          <BotonAccion
            etiqueta="Limpiar"
            onPress={() => establecerEntradasConsola([])}
            compacto
          />
        </View>
        <View style={estilos.consola}>
          {entradasConsola.length === 0 ? (
            <Text style={estilos.textoConsola}>Sin eventos todavía.</Text>
          ) : (
            entradasConsola.map(entrada => (
              <Text
                key={entrada.id}
                style={[estilos.textoConsola, colorConsola(entrada.nivel)]}
              >
                [{entrada.marcaTiempo}] {entrada.nivel.toUpperCase()} ·{' '}
                {entrada.mensaje}
              </Text>
            ))
          )}
        </View>
      </Seccion>
    </ScrollView>
  );
}

// Presenta una linea logica sin mezclarla con fragmentos BLE vecinos.
function DetalleLineaObd({ linea }: { linea: DiagnosticoLineaObd }) {
  return (
    <View style={estilos.tarjetaLineaObd}>
      <Text style={estilos.tituloLineaObd}>
        Línea {linea.numero} · {linea.tipo}
      </Text>
      <Text selectable style={estilos.textoLineaObd}>
        Texto: {linea.texto}
      </Text>
      <Text selectable style={estilos.textoLineaObd}>
        Cabecera: {linea.cabecera ?? 'sin cabecera visible'}
      </Text>
      <Text selectable style={estilos.textoLineaObd}>
        Bytes OBD: {linea.bytesObd.join(' ') || 'ninguno'}
      </Text>
      <Text style={estilos.descripcionLineaObd}>{linea.descripcion}</Text>
      <Text style={estilos.dtcLineaObd}>
        DTC: {linea.codigosDtc.join(', ') || 'ninguno'}
      </Text>
      {linea.advertencias.map(advertencia => (
        <Text key={advertencia} style={estilos.textoAdvertencia}>
          • {advertencia}
        </Text>
      ))}
    </View>
  );
}

interface PropiedadesFilaMetrica {
  nombre: string;
  valor: number | null;
  destacado?: boolean;
}

// Fila compacta para comparar cada etapa sin ocultar la consola tecnica.
function FilaMetrica({ nombre, valor, destacado }: PropiedadesFilaMetrica) {
  return (
    <View style={estilos.filaMetrica}>
      <Text style={estilos.nombreMetrica}>{nombre}</Text>
      <Text
        style={[
          estilos.valorMetrica,
          destacado && estilos.valorMetricaDestacado,
        ]}
      >
        {formatearMilisegundos(valor)}
      </Text>
    </View>
  );
}

// Contenedor visual reutilizable para mantener las cinco secciones uniformes.
function Seccion({
  titulo,
  children: hijos,
}: React.PropsWithChildren<{ titulo: string }>) {
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.tituloSeccion}>{titulo}</Text>
      {hijos}
    </View>
  );
}

interface PropiedadesBotonAccion {
  etiqueta: string;
  onPress: () => void;
  disabled?: boolean;
  peligro?: boolean;
  compacto?: boolean;
}

// Boton comun con variantes de peligro, compacto y deshabilitado.
function BotonAccion({
  etiqueta,
  onPress,
  disabled,
  peligro,
  compacto,
}: PropiedadesBotonAccion) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        estilos.boton,
        peligro && estilos.botonPeligro,
        compacto && estilos.botonCompacto,
        disabled && estilos.botonDeshabilitado,
      ]}
    >
      <Text style={estilos.textoBoton}>{etiqueta}</Text>
    </Pressable>
  );
}

interface PropiedadesOpcionesCaracteristica {
  candidatas: InformacionCaracteristicaGatt[];
  claveSeleccionada: string | null;
  alSeleccionar: (elemento: InformacionCaracteristicaGatt) => void;
  mensajeVacio: string;
}

// Selector tipo radio para candidatos TX o RX encontrados durante GATT.
function OpcionesCaracteristica({
  candidatas,
  claveSeleccionada,
  alSeleccionar,
  mensajeVacio,
}: PropiedadesOpcionesCaracteristica) {
  if (candidatas.length === 0) {
    return <Text style={estilos.vacio}>{mensajeVacio}</Text>;
  }
  return (
    <View style={estilos.listaOpciones}>
      {candidatas.map(elemento => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{
            checked: claveSeleccionada === clavePara(elemento),
          }}
          key={clavePara(elemento)}
          onPress={() => alSeleccionar(elemento)}
          style={[
            estilos.opcion,
            claveSeleccionada === clavePara(elemento) &&
              estilos.opcionSeleccionada,
          ]}
        >
          <Text style={estilos.tituloOpcion}>
            {claveSeleccionada === clavePara(elemento) ? '●' : '○'}{' '}
            {elemento.uuidCaracteristica}
          </Text>
          <Text style={estilos.monoespaciado}>
            Servicio: {elemento.uuidServicio}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// Algunos dispositivos solo publican localName y otros no publican ningun nombre.
function mostrarNombreDispositivo(
  dispositivo: InformacionDispositivoBle,
): string {
  return (
    dispositivo.nombre ?? dispositivo.nombreLocal ?? 'Dispositivo sin nombre'
  );
}

// Un UUID de caracteristica solo es unico dentro de su servicio.
function clavePara(caracteristica: InformacionCaracteristicaGatt): string {
  return `${caracteristica.uuidServicio}|${caracteristica.uuidCaracteristica}`;
}

function siNo(valor: boolean): string {
  return valor ? 'sí' : 'no';
}

// Hace visibles CR y LF en consola sin modificar la respuesta almacenada.
function asciiVisible(valor: string): string {
  return valor.replace(/\r/g, '␍').replace(/\n/g, '␊');
}

function formatearMilisegundos(valor: number | null): string {
  if (valor === null) {
    return 'sin dato';
  }
  if (valor > 0 && valor < 0.01) {
    return '< 0.01 ms';
  }
  return `${valor.toFixed(2)} ms`;
}

function convertirAError(valor: unknown): Error {
  return valor instanceof Error ? valor : new Error(String(valor));
}

// Asigna un color distinto a errores, operaciones TX y fragmentos RX.
function colorConsola(nivel: EntradaConsola['nivel']) {
  switch (nivel) {
    case 'error':
      return estilos.errorConsola;
    case 'exito':
      return estilos.exitoConsola;
    case 'rx':
      return estilos.consolaRx;
    case 'tx':
      return estilos.consolaTx;
    default:
      return undefined;
  }
}

const estilos = StyleSheet.create({
  contenedor: { padding: 16, paddingBottom: 48, backgroundColor: '#F4F7FA' },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#102A43',
    marginBottom: 12,
  },
  tarjetaEstado: {
    backgroundColor: '#DCEEFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  textoEstado: { fontSize: 18, fontWeight: '700', color: '#0B4F82' },
  secundario: { color: '#486581', marginTop: 3 },
  seccion: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  tituloSeccion: {
    fontSize: 19,
    fontWeight: '700',
    color: '#102A43',
    marginBottom: 10,
  },
  filaBotones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boton: {
    backgroundColor: '#1367A7',
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 8,
  },
  botonCompacto: { paddingVertical: 6, paddingHorizontal: 10, marginBottom: 0 },
  botonPeligro: { backgroundColor: '#B42318' },
  botonDeshabilitado: { opacity: 0.4 },
  textoBoton: { color: '#FFFFFF', fontWeight: '700' },
  vacio: { color: '#627D98', fontStyle: 'italic', marginVertical: 8 },
  tarjetaDispositivo: {
    borderWidth: 1,
    borderColor: '#BCCCDC',
    borderRadius: 9,
    padding: 11,
    marginTop: 8,
  },
  tarjetaSeleccionada: { borderColor: '#1367A7', backgroundColor: '#EAF5FF' },
  nombreDispositivo: { fontWeight: '700', color: '#243B53', fontSize: 16 },
  monoespaciado: {
    fontFamily: 'monospace',
    color: '#334E68',
    fontSize: 12,
    marginTop: 3,
  },
  tarjetaGatt: {
    borderLeftWidth: 3,
    borderLeftColor: '#7FB3D5',
    paddingLeft: 10,
    marginBottom: 12,
  },
  propiedades: { color: '#486581', lineHeight: 19, marginTop: 5 },
  etiqueta: {
    fontWeight: '700',
    color: '#243B53',
    marginTop: 10,
    marginBottom: 6,
  },
  ayuda: { color: '#627D98', lineHeight: 19, marginBottom: 8 },
  tarjetaMetricas: {
    backgroundColor: '#EAF5FF',
    borderColor: '#9CC6E3',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  tituloMetricas: {
    color: '#0B4F82',
    fontWeight: '700',
    marginBottom: 7,
  },
  filaMetrica: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 3,
  },
  nombreMetrica: { color: '#334E68', flex: 1 },
  valorMetrica: {
    color: '#0B4F82',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  valorMetricaDestacado: { color: '#1367A7', fontWeight: '800' },
  detalleMetricas: {
    color: '#486581',
    fontSize: 12,
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#BDD7EA',
  },
  bloqueDiagnostico: {
    borderColor: '#BCCCDC',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  subtituloDiagnostico: {
    color: '#243B53',
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 5,
  },
  respuestaCrudaDiagnostico: {
    backgroundColor: '#102A43',
    color: '#E6F1FA',
    borderRadius: 6,
    padding: 9,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  tarjetaLineaObd: {
    backgroundColor: '#F5F8FA',
    borderLeftColor: '#1367A7',
    borderLeftWidth: 3,
    padding: 9,
    marginBottom: 8,
  },
  tituloLineaObd: { color: '#0B4F82', fontWeight: '700' },
  textoLineaObd: {
    color: '#243B53',
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 4,
  },
  descripcionLineaObd: { color: '#486581', marginTop: 5 },
  dtcLineaObd: { color: '#102A43', fontWeight: '700', marginTop: 5 },
  advertenciasDiagnostico: {
    backgroundColor: '#FFF4E5',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  tituloAdvertencias: { color: '#8A4B08', fontWeight: '700' },
  textoAdvertencia: { color: '#9A3412', marginTop: 3 },
  listaOpciones: { marginBottom: 6 },
  opcion: {
    borderWidth: 1,
    borderColor: '#BCCCDC',
    borderRadius: 8,
    padding: 9,
    marginBottom: 7,
  },
  opcionSeleccionada: { borderColor: '#1367A7', backgroundColor: '#EAF5FF' },
  tituloOpcion: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#243B53',
    fontWeight: '700',
  },
  json: {
    backgroundColor: '#EDF2F7',
    color: '#102A43',
    borderRadius: 8,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  cabeceraConsola: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consola: {
    backgroundColor: '#102A43',
    borderRadius: 8,
    padding: 10,
    minHeight: 100,
  },
  textoConsola: {
    fontFamily: 'monospace',
    color: '#D9E2EC',
    fontSize: 11,
    marginBottom: 5,
  },
  errorConsola: { color: '#FFB4AB' },
  exitoConsola: { color: '#A7F3D0' },
  consolaRx: { color: '#93C5FD' },
  consolaTx: { color: '#FDE68A' },
});
