import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SelectorEscaneres } from '../componentes/SelectorEscaneres';
import { PanelPruebaDtc } from '../componentes/PanelPruebaDtc';
import { usePruebaDtc } from '../informes/usarPruebaDtc';
import { version as versionAplicacion } from '../../package.json';
import { useEscaneresGuardados } from '../escaneres/usarEscaneresGuardados';
import {
  crearEscanerVerificado,
  obtenerCombinacionesAutomaticas,
  recuperarCanales,
} from '../escaneres/VerificacionElm';
import {
  analizarRespuestaObd,
  type AnalisisRespuestaObd,
  type DiagnosticoLineaObd,
} from '../obd/AnalisisRespuestaObd';
import { calcularMetricasFlujoObd } from '../obd/MetricasFlujoObd';
import { PanelPidsCompatibles } from '../componentes/PanelPidsCompatibles';
import { useCatalogoVehiculo } from '../obd/mode01/usarCatalogoVehiculo';
import {
  ejecutarDeteccionPids,
  ErrorEjecucionDeteccionPids,
} from '../obd/EjecutarDeteccionPids';
import type { BloquePidsInterpretado } from '../obd/DeteccionPids';
import { comprobarDisponibilidadVin, decodificarVin } from '../obd/LecturaVin';
import { traducirRespuestaObd } from '../obd/ServicioElm327';
import type {
  EntradaConsola,
  EstadoConexion,
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
  MetricasFlujoObd,
  RespuestaElm,
  ResultadoJsonObd,
} from '../tipos/ble';
import { obtenerTiempoMs } from '../utilidades/medicionTiempo';
import { useSesionEscanerObd } from '../escaner/ContextoEscanerObd';

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
  const sesionEscaner = useSesionEscanerObd();
  const escaneres = useEscaneresGuardados();
  const pruebaDtc = usePruebaDtc();
  const [guardadoEnCurso, establecerGuardadoEnCurso] = useState(false);
  const {
    estadoBluetooth,
    estadoConexion,
    dispositivos,
    idDispositivoSeleccionado,
    dispositivoConectado,
    caracteristicas,
    escrituraSeleccionada,
    notificacionSeleccionada,
    claveEscritura,
    claveNotificacion,
    claveSuscripcion,
    conexionEnCurso,
    mensajeVerificacion,
    entradasConsola,
    agregarRegistro,
    establecerMensajeVerificacion,
  } = sesionEscaner;
  const [resultadoJsonVisible, establecerResultadoJsonVisible] = useState<
    string | null
  >(null);
  const [ultimasMetricas, establecerUltimasMetricas] =
    useState<MetricasFlujoObd | null>(null);
  const [ultimoAnalisis, establecerUltimoAnalisis] =
    useState<AnalisisRespuestaObd | null>(null);
  const {
    deteccion: deteccionPids,
    contexto: contextoPids,
    limpiar: limpiarPids,
    establecer: establecerCatalogoVehiculo,
  } = useCatalogoVehiculo();
  const [comandoEnCurso, establecerComandoEnCurso] = useState(false);

  const bloqueoConexion = useRef(false);
  const bloqueoComando = useRef(false);

  useEffect(() => {
    if (!dispositivoConectado) {
      limpiarPids();
    }
  }, [dispositivoConectado, limpiarPids]);

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

  /**
   * La sesion compartida conserva BLE y GATT. Esta pantalla solo restaura los
   * canales que habia verificado anteriormente para este escaner.
   */
  async function conectar(dispositivo: InformacionDispositivoBle) {
    if (bloqueoConexion.current || bloqueoComando.current) {
      return;
    }
    bloqueoConexion.current = true;
    try {
      limpiarPids();
      const resultado = await sesionEscaner.conectar(dispositivo);
      const guardado = escaneres.buscar(resultado.dispositivo.id);
      const canales =
        guardado && recuperarCanales(guardado, resultado.caracteristicas);
      if (canales) {
        sesionEscaner.seleccionarCanales(
          canales.escritura,
          canales.notificacion,
        );
        establecerMensajeVerificacion(
          'Canales guardados restaurados. Verifica de nuevo con ATI si lo necesitas.',
        );
      } else if (guardado) {
        establecerMensajeVerificacion(
          'Los canales guardados no coinciden con el GATT actual. Selecciónalos manualmente y verifica de nuevo.',
        );
      }
    } catch {
      // La sesion compartida ya deja el error en la consola y en su estado.
    } finally {
      bloqueoConexion.current = false;
    }
  }

  /** Cancela suscripciones antes de cerrar la conexion BLE. */
  async function desconectar() {
    if (bloqueoConexion.current || bloqueoComando.current) {
      return;
    }
    bloqueoConexion.current = true;
    limpiarPids();
    try {
      await sesionEscaner.desconectar();
    } catch {
      // La sesion compartida ya informa el problema.
    } finally {
      bloqueoConexion.current = false;
    }
  }

  /**
   * Ejecuta uno o varios comandos en orden. La inicializacion usa esta funcion
   * para no enviar el siguiente comando antes de recibir el prompt del anterior.
   */
  async function ejecutarComandos(comandos: readonly string[]) {
    if (bloqueoComando.current || bloqueoConexion.current) {
      return;
    }
    bloqueoComando.current = true;
    establecerComandoEnCurso(true);
    try {
      for (const comando of comandos) {
        const exitoso = await ejecutarComando(comando);
        if (!exitoso) {
          break;
        }
      }
    } finally {
      bloqueoComando.current = false;
      establecerComandoEnCurso(false);
    }
  }

  /** Comparte el bloqueo ELM existente para que ningun boton intercale comandos. */
  async function iniciarPruebaCompletaDtc() {
    if (
      bloqueoComando.current ||
      bloqueoConexion.current ||
      !dispositivoConectado ||
      !escrituraSeleccionada ||
      !notificacionSeleccionada ||
      pruebaDtc.cargando
    ) {
      return;
    }
    if (!sesionEscaner.estaSuscrito() && !sesionEscaner.activarSuscripcion()) {
      return;
    }
    bloqueoComando.current = true;
    establecerComandoEnCurso(true);
    // El lote tiene su propio informe; no mostrar una captura individual anterior.
    establecerResultadoJsonVisible(null);
    establecerUltimoAnalisis(null);
    establecerUltimasMetricas(null);
    const version = sesionEscaner.obtenerVersionConexion();
    try {
      await pruebaDtc.iniciar({
        dispositivo: dispositivoConectado,
        escritura: escrituraSeleccionada,
        notificacion: notificacionSeleccionada,
        versionAplicacion,
        conectado: () =>
          version === sesionEscaner.obtenerVersionConexion() &&
          sesionEscaner.estaSuscrito(),
        sincronizado: sesionEscaner.estaSincronizado,
        enviar: comando => {
          agregarRegistro('tx', `Prueba DTC TX: ${comando}`);
          return sesionEscaner.enviarComando(comando);
        },
      });
    } finally {
      bloqueoComando.current = false;
      establecerComandoEnCurso(false);
    }
  }

  function solicitarPruebaDtc() {
    if (pruebaDtc.informe) {
      Alert.alert(
        'Nueva prueba DTC',
        'Se reemplazará el último borrador local. Guarda su JSON antes de continuar si quieres conservarlo.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Nueva prueba',
            onPress: () => {
              iniciarPruebaCompletaDtc().catch(informarError);
            },
          },
        ],
      );
    } else {
      iniciarPruebaCompletaDtc().catch(informarError);
    }
  }

  /**
   * Valida selecciones, prepara RX, envia un comando y construye el JSON final.
   * Devuelve null para detener una secuencia si ocurre cualquier error.
   */
  async function ejecutarComando(
    comando: string,
  ): Promise<RespuestaElm | null> {
    if (
      !dispositivoConectado ||
      !escrituraSeleccionada ||
      !notificacionSeleccionada
    ) {
      const mensaje =
        'Conecta el adaptador y selecciona características de escritura y notificación.';
      agregarRegistro('error', mensaje);
      establecerResultadoError(comando, mensaje);
      return null;
    }
    const version = sesionEscaner.obtenerVersionConexion();
    if (['ATZ', 'ATH0', 'ATH1', 'ATSP0'].includes(comando.toUpperCase())) {
      limpiarPids();
    }
    establecerUltimasMetricas(null);
    try {
      const respuesta = await sesionEscaner.enviarComando(comando);
      if (version !== sesionEscaner.obtenerVersionConexion()) {
        return null;
      }
      // La traduccion nunca reemplaza la respuesta cruda: ambas se guardan.
      const inicioTraduccionMs = obtenerTiempoMs();
      const analisis = analizarRespuestaObd(comando, respuesta.textoAscii);
      const traduccion = traducirRespuestaObd(
        comando,
        respuesta.textoAscii,
        contextoPids.current,
      );
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
        sesionEscaner.marcarConectado();
      }
      return respuesta;
    } catch (capturado) {
      if (version !== sesionEscaner.obtenerVersionConexion()) {
        return null;
      }
      const error = convertirAError(capturado);
      sesionEscaner.marcarError(`${comando}: ${error.message}`);
      establecerResultadoError(comando, error.message);
      return null;
    }
  }

  /** Prueba en orden las combinaciones FFF1/FFF1 y FFF2/FFF1 con ATI. */
  async function detectarCanalesAutomaticamente() {
    if (
      bloqueoComando.current ||
      bloqueoConexion.current ||
      escaneres.cargando ||
      !dispositivoConectado
    ) {
      return;
    }
    const combinaciones = obtenerCombinacionesAutomaticas(caracteristicas);
    if (combinaciones.length === 0) {
      establecerMensajeVerificacion(
        'No se encontraron combinaciones FFF1/FFF2 compatibles. Usa la selección manual.',
      );
      agregarRegistro(
        'error',
        'El GATT no contiene FFF1/FFF1 ni FFF2/FFF1 con las propiedades requeridas.',
      );
      return;
    }

    bloqueoComando.current = true;
    establecerComandoEnCurso(true);
    const version = sesionEscaner.obtenerVersionConexion();
    let ultimoError = 'ATI no respondió en las combinaciones conocidas.';
    try {
      for (const combinacion of combinaciones) {
        if (version !== sesionEscaner.obtenerVersionConexion()) {
          return;
        }
        sesionEscaner.seleccionarCanales(
          combinacion.escritura,
          combinacion.notificacion,
        );
        establecerMensajeVerificacion(
          `Probando automáticamente ${combinacion.descripcion} con ATI…`,
        );
        agregarRegistro(
          'informacion',
          `Prueba automática de canales ${combinacion.descripcion}.`,
        );

        try {
          sesionEscaner.cancelarSuscripcion();
          if (!sesionEscaner.activarSuscripcion(combinacion.notificacion)) {
            throw new Error('No fue posible activar el canal de recepción.');
          }
          const respuesta = await sesionEscaner.enviarComando('ATI', {
            escritura: combinacion.escritura,
            tiempoEsperaMs: 5000,
          });
          const registro = crearEscanerVerificado(
            dispositivoConectado,
            combinacion.escritura,
            combinacion.notificacion,
            respuesta.textoAscii,
          );
          await escaneres.guardar(registro);
          if (version !== sesionEscaner.obtenerVersionConexion()) {
            return;
          }
          establecerMensajeVerificacion(
            `✓ Canales detectados: ${combinacion.descripcion}. ${registro.identificacionElm}.`,
          );
          agregarRegistro(
            'exito',
            `Canales ${combinacion.descripcion} verificados y guardados con ATI.`,
          );
          sesionEscaner.marcarConectado();
          return;
        } catch (capturado) {
          ultimoError = convertirAError(capturado).message;
          agregarRegistro(
            'informacion',
            `${combinacion.descripcion} no fue validado: ${ultimoError}`,
          );
        }
      }

      sesionEscaner.cancelarSuscripcion();
      establecerMensajeVerificacion(
        `No se detectaron canales automáticamente. Último resultado: ${ultimoError} Usa la selección manual.`,
      );
      agregarRegistro(
        'error',
        'Finalizaron las combinaciones automáticas sin una respuesta ATI válida.',
      );
    } finally {
      bloqueoComando.current = false;
      establecerComandoEnCurso(false);
    }
  }

  /** Envia solo ATI en los canales elegidos y persiste tras validar la respuesta. */
  async function verificarYGuardar() {
    if (
      bloqueoComando.current ||
      bloqueoConexion.current ||
      escaneres.cargando ||
      !dispositivoConectado ||
      !escrituraSeleccionada ||
      !notificacionSeleccionada
    ) {
      return;
    }
    bloqueoComando.current = true;
    establecerComandoEnCurso(true);
    const version = sesionEscaner.obtenerVersionConexion();
    establecerMensajeVerificacion('Verificando identificación con ATI…');
    try {
      const respuesta = await ejecutarComando('ATI');
      if (version !== sesionEscaner.obtenerVersionConexion()) {
        return;
      }
      if (!respuesta) {
        establecerMensajeVerificacion(
          'No se pudo verificar. Revisa los canales y la conexión; no se guardó un registro nuevo.',
        );
        return;
      }
      const registro = crearEscanerVerificado(
        dispositivoConectado,
        escrituraSeleccionada,
        notificacionSeleccionada,
        respuesta.textoAscii,
      );
      await escaneres.guardar(registro);
      if (version === sesionEscaner.obtenerVersionConexion()) {
        establecerMensajeVerificacion(
          `Verificado y guardado: ${registro.identificacionElm}. Esto no confirma comunicación con el vehículo.`,
        );
      }
      agregarRegistro(
        'exito',
        `Escáner guardado localmente: ${registro.identificacionElm}.`,
      );
    } catch (capturado) {
      const mensaje = convertirAError(capturado).message;
      if (version === sesionEscaner.obtenerVersionConexion()) {
        establecerMensajeVerificacion(
          `No se pudo completar el guardado: ${mensaje}`,
        );
      }
      agregarRegistro('error', mensaje);
    } finally {
      bloqueoComando.current = false;
      establecerComandoEnCurso(false);
    }
  }

  /** Recorre los bloques Mode 01 y resume los PID declarados por la ECU. */
  async function detectarPidsCompatibles() {
    if (
      bloqueoComando.current ||
      bloqueoConexion.current ||
      !dispositivoConectado ||
      !escrituraSeleccionada ||
      !notificacionSeleccionada
    ) {
      return;
    }
    bloqueoComando.current = true;
    establecerComandoEnCurso(true);
    limpiarPids();
    const version = sesionEscaner.obtenerVersionConexion();
    let bloques: BloquePidsInterpretado[] = [];
    try {
      const resultadoDeteccion = await ejecutarDeteccionPids({
        enviar: async comando => {
          const respuesta = await ejecutarComando(comando);
          if (!respuesta) {
            throw new Error(`No se completo la consulta ${comando}.`);
          }
          return respuesta;
        },
        conectado: () =>
          version === sesionEscaner.obtenerVersionConexion(),
        sincronizado: sesionEscaner.estaSincronizado,
        alProgresar: progreso => {
          if (
            progreso.etapa === 'bloques' &&
            progreso.momento === 'resultado'
          ) {
            agregarRegistro('informacion', progreso.mensaje);
          }
        },
      });
      bloques = resultadoDeteccion.bloques;
      const {
        deteccion,
        respuestasConfiguracion,
        advertenciasConfiguracion,
      } = resultadoDeteccion;
      establecerCatalogoVehiculo(deteccion, respuestasConfiguracion);
      const resultado: ResultadoJsonObd = {
        fecha: new Date().toISOString(),
        dispositivo: {
          nombre: mostrarNombreDispositivo(dispositivoConectado),
          identificador: dispositivoConectado.id,
        },
        comando: [
          ...bloques.map(bloque => bloque.comando),
          ...Object.keys(respuestasConfiguracion),
        ].join(' -> '),
        respuestaCruda: [
          ...bloques.map(bloque => `${bloque.comando}: ${bloque.respuestaCruda}`),
          ...Object.entries(respuestasConfiguracion).map(
            ([comando, cruda]) => `${comando}: ${cruda}`,
          ),
        ].join('\n'),
        datoTraducido: deteccion,
        unidad: 'PID Mode 01',
        erroresComunicacion: advertenciasConfiguracion,
      };
      establecerResultadoJsonVisible(JSON.stringify(resultado, null, 2));
      agregarRegistro(
        'exito',
        `Detección terminada: ${deteccion.cantidadPidsSoportados} PID de datos; ${deteccion.cantidadInterpretables} ya interpretables y ${deteccion.cantidadPendientes} pendientes.`,
      );
    } catch (capturado) {
      if (version !== sesionEscaner.obtenerVersionConexion()) {
        return;
      }
      if (capturado instanceof ErrorEjecucionDeteccionPids) {
        bloques = capturado.captura.bloques;
      }
      const mensaje = convertirAError(capturado).message;
      const resultado: ResultadoJsonObd = {
        fecha: new Date().toISOString(),
        dispositivo: {
          nombre: mostrarNombreDispositivo(dispositivoConectado),
          identificador: dispositivoConectado.id,
        },
        comando: bloques.map(bloque => bloque.comando).join(' -> ') || '0100',
        respuestaCruda:
          bloques.length > 0
            ? bloques
                .map(bloque => `${bloque.comando}: ${bloque.respuestaCruda}`)
                .join('\n')
            : null,
        datoTraducido: null,
        unidad: null,
        erroresComunicacion: [mensaje],
      };
      establecerResultadoJsonVisible(JSON.stringify(resultado, null, 2));
      agregarRegistro('error', `Detección de PID: ${mensaje}`);
    } finally {
      bloqueoComando.current = false;
      establecerComandoEnCurso(false);
    }
  }

  /** Comprueba Mode 09 PID 02 y reconstruye el VIN si esta disponible. */
  async function leerVinVehiculo() {
    if (
      bloqueoComando.current ||
      bloqueoConexion.current ||
      !dispositivoConectado ||
      !escrituraSeleccionada ||
      !notificacionSeleccionada
    ) {
      return;
    }
    bloqueoComando.current = true;
    establecerComandoEnCurso(true);
    let respuesta0900: RespuestaElm | null = null;
    let respuesta0902: RespuestaElm | null = null;
    try {
      respuesta0900 = await ejecutarComando('0900');
      if (!respuesta0900) {
        return;
      }
      const disponibilidad = comprobarDisponibilidadVin(
        respuesta0900.textoAscii,
      );
      agregarRegistro(
        'informacion',
        `0900: máscara ${disponibilidad.mascaraHexadecimal}; VIN ${
          disponibilidad.disponible ? 'disponible' : 'no anunciado'
        }.`,
      );

      if (!disponibilidad.disponible) {
        const mensaje = 'La ECU no declara compatibilidad con Mode 09 PID 02.';
        const resultado: ResultadoJsonObd = {
          fecha: new Date().toISOString(),
          dispositivo: {
            nombre: mostrarNombreDispositivo(dispositivoConectado),
            identificador: dispositivoConectado.id,
          },
          comando: '0900',
          respuestaCruda: respuesta0900.textoAscii,
          datoTraducido: null,
          unidad: 'VIN',
          erroresComunicacion: [mensaje],
        };
        establecerResultadoJsonVisible(JSON.stringify(resultado, null, 2));
        agregarRegistro('informacion', mensaje);
        return;
      }

      respuesta0902 = await ejecutarComando('0902');
      if (!respuesta0902) {
        return;
      }
      const vin = decodificarVin(respuesta0902.textoAscii);
      const resultado: ResultadoJsonObd = {
        fecha: new Date().toISOString(),
        dispositivo: {
          nombre: mostrarNombreDispositivo(dispositivoConectado),
          identificador: dispositivoConectado.id,
        },
        comando: '0900 -> 0902',
        respuestaCruda: `0900: ${respuesta0900.textoAscii}\n0902: ${respuesta0902.textoAscii}`,
        datoTraducido: vin,
        unidad: 'VIN',
        erroresComunicacion: [],
      };
      establecerResultadoJsonVisible(JSON.stringify(resultado, null, 2));
      agregarRegistro('exito', `VIN leído correctamente: ${vin}.`);
    } catch (capturado) {
      const mensaje = convertirAError(capturado).message;
      const respuestas = [
        respuesta0900 && `0900: ${respuesta0900.textoAscii}`,
        respuesta0902 && `0902: ${respuesta0902.textoAscii}`,
      ].filter((valor): valor is string => Boolean(valor));
      const resultado: ResultadoJsonObd = {
        fecha: new Date().toISOString(),
        dispositivo: {
          nombre: mostrarNombreDispositivo(dispositivoConectado),
          identificador: dispositivoConectado.id,
        },
        comando: respuesta0902 ? '0900 -> 0902' : '0900',
        respuestaCruda: respuestas.join('\n') || null,
        datoTraducido: null,
        unidad: 'VIN',
        erroresComunicacion: [mensaje],
      };
      establecerResultadoJsonVisible(JSON.stringify(resultado, null, 2));
      agregarRegistro('error', `Lectura VIN: ${mensaje}`);
    } finally {
      bloqueoComando.current = false;
      establecerComandoEnCurso(false);
    }
  }

  async function olvidarEscaner(id: string) {
    if (bloqueoComando.current || bloqueoConexion.current) {
      return;
    }
    bloqueoComando.current = true;
    establecerGuardadoEnCurso(true);
    try {
      await escaneres.olvidar(id);
      if (dispositivoConectado?.id === id) {
        establecerMensajeVerificacion(
          'Registro local olvidado. La conexión actual sigue disponible.',
        );
      }
    } catch (capturado) {
      agregarRegistro(
        'error',
        `No se pudo olvidar el escáner: ${convertirAError(capturado).message}`,
      );
    } finally {
      bloqueoComando.current = false;
      establecerGuardadoEnCurso(false);
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
    sesionEscaner.marcarError(error.message);
  }

  const interfazOcupada =
    conexionEnCurso || comandoEnCurso || guardadoEnCurso || pruebaDtc.guardando;

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
            onPress={() => sesionEscaner.prepararBluetooth()}
            disabled={interfazOcupada}
          />
          <BotonAccion
            etiqueta="Buscar BLE"
            onPress={() => sesionEscaner.iniciarEscaneo()}
            disabled={estadoConexion === 'buscando' || interfazOcupada}
          />
          <BotonAccion
            etiqueta="Detener"
            onPress={sesionEscaner.detenerEscaneo}
            disabled={estadoConexion !== 'buscando' || interfazOcupada}
          />
          <BotonAccion
            etiqueta="Desconectar"
            onPress={() => desconectar()}
            disabled={!dispositivoConectado || interfazOcupada}
            peligro
          />
        </View>
        <SelectorEscaneres
          dispositivos={dispositivos}
          guardados={escaneres.guardados}
          seleccionado={idDispositivoSeleccionado}
          ocupado={interfazOcupada}
          buscando={estadoConexion === 'buscando'}
          cargandoGuardados={escaneres.cargando}
          errorGuardados={escaneres.error}
          alConectar={dispositivo => conectar(dispositivo)}
          alOlvidar={id => olvidarEscaner(id)}
        />
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
          alSeleccionar={sesionEscaner.elegirEscritura}
          mensajeVacio="No se detectaron características escribibles."
        />
        <Text style={estilos.etiqueta}>
          Candidatas para notificación o indicación
        </Text>
        <OpcionesCaracteristica
          candidatas={candidatasNotificacion}
          claveSeleccionada={claveNotificacion}
          alSeleccionar={sesionEscaner.elegirNotificacion}
          mensajeVacio="No se detectaron características notificables."
        />
        <BotonAccion
          etiqueta={
            claveSuscripcion ? 'Suscripción activa' : 'Suscribirse a RX'
          }
          onPress={() => sesionEscaner.activarSuscripcion()}
          disabled={
            !notificacionSeleccionada ||
            !dispositivoConectado ||
            claveSuscripcion === claveNotificacion
          }
        />
        <Text style={estilos.ayuda}>{mensajeVerificacion}</Text>
        <BotonAccion
          etiqueta="Detectar canales automáticamente · ATI"
          onPress={() => detectarCanalesAutomaticamente()}
          disabled={
            interfazOcupada || escaneres.cargando || !dispositivoConectado
          }
        />
        <BotonAccion
          etiqueta="Verificar selección manual · ATI"
          onPress={() => verificarYGuardar()}
          disabled={
            interfazOcupada ||
            escaneres.cargando ||
            !dispositivoConectado ||
            !escrituraSeleccionada ||
            !notificacionSeleccionada
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
            disabled={interfazOcupada}
          />
          <BotonAccion
            etiqueta="ATZ"
            onPress={() => ejecutarComandos(['ATZ'])}
            disabled={interfazOcupada}
          />
          <BotonAccion
            etiqueta="Cabeceras ON · ATH1"
            onPress={() => ejecutarComandos(['ATH1'])}
            disabled={interfazOcupada}
          />
          <BotonAccion
            etiqueta="Inicializar ELM327"
            onPress={() => ejecutarComandos(COMANDOS_INICIALIZACION)}
            disabled={interfazOcupada}
          />
          <BotonAccion
            etiqueta="Detectar PID compatibles"
            onPress={() => detectarPidsCompatibles()}
            disabled={
              interfazOcupada ||
              !dispositivoConectado ||
              !escrituraSeleccionada ||
              !notificacionSeleccionada
            }
          />
          <BotonAccion
            etiqueta="Leer VIN · 0902"
            onPress={() => leerVinVehiculo()}
            disabled={
              interfazOcupada ||
              !dispositivoConectado ||
              !escrituraSeleccionada ||
              !notificacionSeleccionada
            }
          />
        </View>
        <PanelPruebaDtc
          informe={pruebaDtc.informe}
          progreso={pruebaDtc.progreso}
          notas={pruebaDtc.notas}
          cargando={pruebaDtc.cargando}
          ejecutando={pruebaDtc.ejecutando}
          guardando={pruebaDtc.guardando}
          error={pruebaDtc.error}
          alCambiarNotas={pruebaDtc.establecerNotas}
          alIniciar={solicitarPruebaDtc}
          alDetener={pruebaDtc.detener}
          alGuardar={() => {
            pruebaDtc.guardar().catch(informarError);
          }}
          deshabilitado={
            interfazOcupada ||
            !dispositivoConectado ||
            !escrituraSeleccionada ||
            !notificacionSeleccionada
          }
        />
        <PanelPidsCompatibles
          deteccion={deteccionPids}
          deshabilitado={
            interfazOcupada ||
            !dispositivoConectado ||
            !escrituraSeleccionada ||
            !notificacionSeleccionada
          }
          alConsultar={comando => ejecutarComandos([comando])}
        />
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
            onPress={sesionEscaner.limpiarRegistros}
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
