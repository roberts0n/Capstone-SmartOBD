import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { State, type Subscription } from 'react-native-ble-plx';
import {
  BleService,
  isBluetoothUnavailable,
  isBluetoothUsable,
} from '../ble/BleService';
import { Elm327Service, translateObdResponse } from '../obd/Elm327Service';
import type {
  BleDeviceInfo,
  ConnectionStatus,
  ConsoleEntry,
  GattCharacteristicInfo,
  ObdJsonResult,
} from '../types/ble';

// Secuencia minima recomendada para dejar ELM327 en un formato de respuesta
// predecible: sin eco, saltos de linea, espacios ni cabeceras, y protocolo auto.
const INITIALIZATION_COMMANDS = [
  'ATZ',
  'ATE0',
  'ATL0',
  'ATS0',
  'ATH0',
  'ATSP0',
];

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: 'Listo',
  'bluetooth-unavailable': 'Bluetooth no disponible',
  scanning: 'Buscando',
  connecting: 'Conectando',
  connected: 'Conectado',
  disconnected: 'Desconectado',
  error: 'Error',
};

/**
 * Pantalla unica de la demo.
 *
 * Coordina tres responsabilidades ya separadas:
 * - BleService: permisos, escaneo, conexion y GATT.
 * - Elm327Service: comandos ASCII y respuestas fragmentadas.
 * - React: estado visible, seleccion manual, consola y JSON.
 */
export function ObdScannerScreen() {
  // Los servicios se crean una sola vez para conservar el BleManager y sus
  // suscripciones aunque React vuelva a renderizar la pantalla.
  const [bleService] = useState(() => new BleService());
  const [elmService] = useState(() => new Elm327Service(bleService));

  // Estado de Bluetooth, busqueda, conexion e inventario GATT.
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [devices, setDevices] = useState<BleDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<BleDeviceInfo | null>(
    null,
  );
  const [characteristics, setCharacteristics] = useState<
    GattCharacteristicInfo[]
  >([]);

  // Las claves combinan UUID de servicio y caracteristica. Esto evita colisiones
  // si dos servicios exponen el mismo UUID de caracteristica.
  const [writeKey, setWriteKey] = useState<string | null>(null);
  const [notifyKey, setNotifyKey] = useState<string | null>(null);
  const [subscribedKey, setSubscribedKey] = useState<string | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [lastResult, setLastResult] = useState<ObdJsonResult | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);

  // Las suscripciones y el contador no necesitan provocar renderizados.
  const disconnectSubscription = useRef<Subscription | null>(null);
  const logSequence = useRef(0);

  // Conserva como maximo 200 eventos para que una sesion larga no crezca sin
  // limite en memoria. Cada entrada tiene un id estable para renderizar la lista.
  const addLog = useCallback(
    (level: ConsoleEntry['level'], message: string) => {
      const entry: ConsoleEntry = {
        id: ++logSequence.current,
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
      };
      setConsoleEntries(previous => [...previous.slice(-199), entry]);
    },
    [],
  );

  // Observa el estado nativo de Bluetooth durante toda la vida de la pantalla.
  // El retorno del efecto es la limpieza central de recursos BLE y ELM327.
  useEffect(() => {
    const stateSubscription = bleService.onBluetoothStateChange(state => {
      setBluetoothState(state);
      if (isBluetoothUnavailable(state) || state === State.PoweredOff) {
        setStatus('bluetooth-unavailable');
      }
    });

    return () => {
      stateSubscription.remove();
      disconnectSubscription.current?.remove();
      elmService.unsubscribe();
      bleService.destroy().catch(() => undefined);
    };
  }, [bleService, elmService]);

  // GATT no indica cual canal pertenece a ELM327. Se muestran como candidatos
  // todas las caracteristicas que tecnicamente permiten TX o RX.
  const writeCandidates = useMemo(
    () =>
      characteristics.filter(
        item => item.isWritableWithResponse || item.isWritableWithoutResponse,
      ),
    [characteristics],
  );
  const notifyCandidates = useMemo(
    () =>
      characteristics.filter(item => item.isNotifiable || item.isIndicatable),
    [characteristics],
  );
  const selectedWrite =
    writeCandidates.find(item => keyFor(item) === writeKey) ?? null;
  const selectedNotify =
    notifyCandidates.find(item => keyFor(item) === notifyKey) ?? null;

  /** Solicita permisos y confirma que Bluetooth este encendido. */
  async function prepareBluetooth(): Promise<boolean> {
    try {
      const granted = await bleService.requestAndroidPermissions();
      if (!granted) {
        throw new Error('Permisos Bluetooth denegados.');
      }
      const state = await bleService.getBluetoothState();
      setBluetoothState(state);
      if (!isBluetoothUsable(state)) {
        setStatus('bluetooth-unavailable');
        addLog(
          'error',
          `Bluetooth no está listo: ${state}. Enciéndelo e intenta otra vez.`,
        );
        return false;
      }
      addLog('success', 'Permisos concedidos y Bluetooth encendido.');
      if (!connectedDevice) {
        setStatus('idle');
      }
      return true;
    } catch (caught) {
      reportError(caught);
      return false;
    }
  }

  /** Inicia un escaneo nuevo y elimina duplicados usando el id del dispositivo. */
  async function startScan() {
    if (!(await prepareBluetooth())) {
      return;
    }
    setDevices([]);
    setSelectedDeviceId(null);
    setStatus('scanning');
    addLog('info', 'Búsqueda BLE iniciada.');
    bleService.startScan(
      device => {
        setDevices(previous => {
          const existingIndex = previous.findIndex(
            item => item.id === device.id,
          );
          const next = [...previous];
          if (existingIndex >= 0) {
            next[existingIndex] = device;
          } else {
            next.push(device);
          }
          // Los dispositivos con mejor senal se muestran primero.
          return next.sort(
            (left, right) => (right.rssi ?? -999) - (left.rssi ?? -999),
          );
        });
      },
      error => {
        setStatus('error');
        addLog('error', `Error de búsqueda: ${error.message}`);
      },
    );
  }

  /** Detiene manualmente el escaneo y restaura el estado visible. */
  function stopScan() {
    bleService.stopScan();
    if (status === 'scanning') {
      setStatus(connectedDevice ? 'connected' : 'idle');
    }
    addLog('info', 'Búsqueda BLE detenida.');
  }

  /**
   * Conecta el dispositivo seleccionado, descubre GATT y arma su inventario.
   * Si ya existia otra conexion, se cierra antes de abrir la nueva.
   */
  async function connect(device: BleDeviceInfo) {
    try {
      bleService.stopScan();
      elmService.unsubscribe();
      setSubscribedKey(null);
      if (connectedDevice) {
        disconnectSubscription.current?.remove();
        disconnectSubscription.current = null;
        await bleService.disconnect();
        setConnectedDevice(null);
      }
      setStatus('connecting');
      setSelectedDeviceId(device.id);
      addLog(
        'info',
        `Conectando con ${displayDeviceName(device)} (${device.id})…`,
      );
      const discovered = await bleService.connectAndDiscover(device.id);
      const connected: BleDeviceInfo = {
        id: discovered.device.id,
        name: discovered.device.name ?? device.name,
        localName: discovered.device.localName ?? device.localName,
        rssi: discovered.device.rssi ?? device.rssi,
      };
      setConnectedDevice(connected);
      setCharacteristics(discovered.characteristics);
      setWriteKey(null);
      setNotifyKey(null);
      setStatus('connected');
      addLog(
        'success',
        `Conectado. Se encontraron ${discovered.characteristics.length} características GATT.`,
      );

      disconnectSubscription.current?.remove();
      // Esta suscripcion tambien detecta desconexiones fisicas inesperadas.
      disconnectSubscription.current = bleService.onDisconnected(
        device.id,
        error => {
          elmService.unsubscribe();
          setSubscribedKey(null);
          setConnectedDevice(null);
          setStatus('disconnected');
          addLog(
            error ? 'error' : 'info',
            error
              ? `Desconexión BLE: ${error.message}`
              : 'El dispositivo se desconectó.',
          );
        },
      );
    } catch (caught) {
      await bleService.disconnect().catch(() => undefined);
      reportError(caught);
    }
  }

  /** Cancela suscripciones antes de cerrar la conexion BLE. */
  async function disconnect() {
    try {
      elmService.unsubscribe();
      setSubscribedKey(null);
      disconnectSubscription.current?.remove();
      disconnectSubscription.current = null;
      await bleService.disconnect();
      setConnectedDevice(null);
      setStatus('disconnected');
      addLog('info', 'Conexión cerrada por el usuario.');
    } catch (caught) {
      reportError(caught);
    }
  }

  /** Guarda la caracteristica elegida para enviar comandos. */
  function chooseWrite(item: GattCharacteristicInfo) {
    setWriteKey(keyFor(item));
    addLog(
      'info',
      `Característica de escritura seleccionada: ${item.characteristicUUID}`,
    );
  }

  /**
   * Cambia la caracteristica RX. La suscripcion anterior debe cancelarse porque
   * monitorCharacteristicForDevice queda ligado al UUID anterior.
   */
  function chooseNotify(item: GattCharacteristicInfo) {
    elmService.unsubscribe();
    setSubscribedKey(null);
    setNotifyKey(keyFor(item));
    addLog(
      'info',
      `Característica de notificación seleccionada: ${item.characteristicUUID}`,
    );
  }

  /**
   * Activa notificaciones RX y registra cada fragmento como ASCII y hexadecimal.
   * La union de fragmentos hasta ">" se realiza dentro de Elm327Service.
   */
  function subscribeToNotifications(): boolean {
    if (!connectedDevice || !selectedNotify) {
      addLog(
        'error',
        'Selecciona un dispositivo y una característica de notificación.',
      );
      return false;
    }
    const selectedKey = keyFor(selectedNotify);
    elmService.subscribe(connectedDevice.id, selectedNotify, {
      onChunk: (ascii, bytes) => {
        const hex = bytes
          .map(byte => byte.toString(16).padStart(2, '0'))
          .join(' ')
          .toUpperCase();
        addLog('rx', `RX ASCII: ${visibleAscii(ascii)} | bytes: ${hex}`);
      },
      onError: error => {
        setStatus('error');
        setSubscribedKey(null);
        addLog('error', `Error de notificación: ${error.message}`);
      },
    });
    setSubscribedKey(selectedKey);
    addLog(
      'success',
      `Suscripción activa: ${selectedNotify.characteristicUUID}`,
    );
    return true;
  }

  /**
   * Ejecuta uno o varios comandos en orden. La inicializacion usa esta funcion
   * para no enviar el siguiente comando antes de recibir el prompt del anterior.
   */
  async function runCommands(commands: readonly string[]) {
    if (commandBusy) {
      return;
    }
    setCommandBusy(true);
    try {
      for (const command of commands) {
        const succeeded = await executeCommand(command);
        if (!succeeded) {
          break;
        }
      }
    } finally {
      setCommandBusy(false);
    }
  }

  /**
   * Valida selecciones, prepara RX, envia un comando y construye el JSON final.
   * Devuelve false para detener una secuencia si ocurre cualquier error.
   */
  async function executeCommand(command: string): Promise<boolean> {
    if (!connectedDevice || !selectedWrite || !selectedNotify) {
      const message =
        'Conecta el adaptador y selecciona características de escritura y notificación.';
      addLog('error', message);
      setResultForError(command, message);
      return false;
    }
    const notifySelectionKey = keyFor(selectedNotify);
    if (subscribedKey !== notifySelectionKey && !subscribeToNotifications()) {
      return false;
    }

    addLog('tx', `TX ASCII: ${command.toUpperCase()}\\r`);
    try {
      const response = await elmService.sendCommand(
        connectedDevice.id,
        selectedWrite,
        command,
      );
      // La traduccion nunca reemplaza la respuesta cruda: ambas se guardan.
      const translation = translateObdResponse(command, response.ascii);
      const communicationErrors = translation.error ? [translation.error] : [];
      setLastResult({
        fecha: new Date().toISOString(),
        dispositivo: {
          nombre: displayDeviceName(connectedDevice),
          identificador: connectedDevice.id,
        },
        comando: command,
        respuestaCruda: response.ascii,
        datoTraducido: translation.value,
        unidad: translation.unit,
        erroresComunicacion: communicationErrors,
      });
      addLog(
        translation.error ? 'error' : 'success',
        translation.error ?? `Respuesta completa recibida para ${command}.`,
      );
      if (status === 'error') {
        setStatus('connected');
      }
      return true;
    } catch (caught) {
      const error = asError(caught);
      setStatus('error');
      addLog('error', `${command}: ${error.message}`);
      setResultForError(command, error.message);
      return false;
    }
  }

  /** Crea un resultado JSON incluso cuando no se recibio respuesta. */
  function setResultForError(command: string, message: string) {
    setLastResult({
      fecha: new Date().toISOString(),
      dispositivo: connectedDevice
        ? {
            nombre: displayDeviceName(connectedDevice),
            identificador: connectedDevice.id,
          }
        : null,
      comando: command,
      respuestaCruda: null,
      datoTraducido: null,
      unidad: null,
      erroresComunicacion: [message],
    });
  }

  /** Normaliza errores desconocidos y los refleja en estado y consola. */
  function reportError(caught: unknown) {
    const error = asError(caught);
    setStatus('error');
    addLog('error', error.message);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Demo ELM327 BLE</Text>
      <View style={styles.statusCard}>
        <Text style={styles.statusText}>Estado: {STATUS_LABELS[status]}</Text>
        <Text style={styles.secondary}>Bluetooth: {bluetoothState}</Text>
        <Text style={styles.secondary}>
          Dispositivo:{' '}
          {connectedDevice ? displayDeviceName(connectedDevice) : 'ninguno'}
        </Text>
      </View>

      <Section title="1. Bluetooth y búsqueda">
        <View style={styles.buttonRow}>
          <ActionButton
            label="Permisos / comprobar"
            onPress={() => prepareBluetooth()}
          />
          <ActionButton
            label="Buscar BLE"
            onPress={() => startScan()}
            disabled={status === 'scanning'}
          />
          <ActionButton
            label="Detener"
            onPress={stopScan}
            disabled={status !== 'scanning'}
          />
          <ActionButton
            label="Desconectar"
            onPress={() => disconnect()}
            disabled={!connectedDevice}
            danger
          />
        </View>
        {devices.length === 0 ? (
          <Text style={styles.empty}>
            No hay dispositivos encontrados todavía.
          </Text>
        ) : (
          devices.map(device => (
            <Pressable
              accessibilityRole="button"
              key={device.id}
              onPress={() => connect(device)}
              style={[
                styles.deviceCard,
                selectedDeviceId === device.id && styles.selectedCard,
              ]}
            >
              <Text style={styles.deviceName}>{displayDeviceName(device)}</Text>
              <Text style={styles.mono}>{device.id}</Text>
              <Text style={styles.secondary}>
                RSSI: {device.rssi ?? 'sin dato'} dBm
              </Text>
            </Pressable>
          ))
        )}
      </Section>

      <Section title={`2. GATT (${characteristics.length})`}>
        {characteristics.length === 0 ? (
          <Text style={styles.empty}>
            Conecta un dispositivo para enumerar servicios y características.
          </Text>
        ) : (
          characteristics.map(item => (
            <View key={keyFor(item)} style={styles.gattCard}>
              <Text style={styles.mono}>Servicio: {item.serviceUUID}</Text>
              <Text style={styles.mono}>
                Característica: {item.characteristicUUID}
              </Text>
              <Text style={styles.properties}>
                Lectura {yesNo(item.isReadable)} · Escritura con respuesta{' '}
                {yesNo(item.isWritableWithResponse)} · sin respuesta{' '}
                {yesNo(item.isWritableWithoutResponse)} · Notificación{' '}
                {yesNo(item.isNotifiable)} · Indicación{' '}
                {yesNo(item.isIndicatable)}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section title="3. Características ELM327">
        <Text style={styles.label}>Candidatas para escritura</Text>
        <CharacteristicChoices
          candidates={writeCandidates}
          selectedKey={writeKey}
          onSelect={chooseWrite}
          emptyMessage="No se detectaron características escribibles."
        />
        <Text style={styles.label}>
          Candidatas para notificación o indicación
        </Text>
        <CharacteristicChoices
          candidates={notifyCandidates}
          selectedKey={notifyKey}
          onSelect={chooseNotify}
          emptyMessage="No se detectaron características notificables."
        />
        <ActionButton
          label={subscribedKey ? 'Suscripción activa' : 'Suscribirse a RX'}
          onPress={subscribeToNotifications}
          disabled={
            !selectedNotify || !connectedDevice || subscribedKey === notifyKey
          }
        />
      </Section>

      <Section title="4. Comandos ELM327">
        <Text style={styles.help}>
          Cada comando se envía como ASCII más retorno de carro. Las respuestas
          se acumulan hasta el prompt &gt;.
        </Text>
        <View style={styles.buttonRow}>
          <ActionButton
            label="ATI"
            onPress={() => runCommands(['ATI'])}
            disabled={commandBusy}
          />
          <ActionButton
            label="ATZ"
            onPress={() => runCommands(['ATZ'])}
            disabled={commandBusy}
          />
          <ActionButton
            label="Inicializar ELM327"
            onPress={() => runCommands(INITIALIZATION_COMMANDS)}
            disabled={commandBusy}
          />
          <ActionButton
            label="RPM · 010C"
            onPress={() => runCommands(['010C'])}
            disabled={commandBusy}
          />
          <ActionButton
            label="Temperatura · 0105"
            onPress={() => runCommands(['0105'])}
            disabled={commandBusy}
          />
          <ActionButton
            label="DTC almacenados · 03"
            onPress={() => runCommands(['03'])}
            disabled={commandBusy}
          />
        </View>
        <Text style={styles.label}>Resultado JSON</Text>
        <Text style={styles.json}>
          {lastResult
            ? JSON.stringify(lastResult, null, 2)
            : 'Todavía no existe una respuesta real. Conecta el ELM327 y envía un comando.'}
        </Text>
      </Section>

      <Section title="5. Consola de eventos y errores">
        <View style={styles.consoleHeader}>
          <Text style={styles.help}>{consoleEntries.length} eventos</Text>
          <ActionButton
            label="Limpiar"
            onPress={() => setConsoleEntries([])}
            compact
          />
        </View>
        <View style={styles.console}>
          {consoleEntries.length === 0 ? (
            <Text style={styles.consoleText}>Sin eventos todavía.</Text>
          ) : (
            consoleEntries.map(entry => (
              <Text
                key={entry.id}
                style={[styles.consoleText, consoleColor(entry.level)]}
              >
                [{entry.timestamp}] {entry.level.toUpperCase()} ·{' '}
                {entry.message}
              </Text>
            ))
          )}
        </View>
      </Section>
    </ScrollView>
  );
}

// Contenedor visual reutilizable para mantener las cinco secciones uniformes.
function Section({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  compact?: boolean;
}

// Boton comun con variantes de peligro, compacto y deshabilitado.
function ActionButton({
  label,
  onPress,
  disabled,
  danger,
  compact,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        danger && styles.dangerButton,
        compact && styles.compactButton,
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

interface CharacteristicChoicesProps {
  candidates: GattCharacteristicInfo[];
  selectedKey: string | null;
  onSelect: (item: GattCharacteristicInfo) => void;
  emptyMessage: string;
}

// Selector tipo radio para candidatos TX o RX encontrados durante GATT.
function CharacteristicChoices({
  candidates,
  selectedKey,
  onSelect,
  emptyMessage,
}: CharacteristicChoicesProps) {
  if (candidates.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }
  return (
    <View style={styles.choiceList}>
      {candidates.map(item => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedKey === keyFor(item) }}
          key={keyFor(item)}
          onPress={() => onSelect(item)}
          style={[
            styles.choice,
            selectedKey === keyFor(item) && styles.selectedChoice,
          ]}
        >
          <Text style={styles.choiceTitle}>
            {selectedKey === keyFor(item) ? '●' : '○'} {item.characteristicUUID}
          </Text>
          <Text style={styles.mono}>Servicio: {item.serviceUUID}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Algunos dispositivos solo publican localName y otros no publican ningun nombre.
function displayDeviceName(device: BleDeviceInfo): string {
  return device.name ?? device.localName ?? 'Dispositivo sin nombre';
}

// Un UUID de caracteristica solo es unico dentro de su servicio.
function keyFor(characteristic: GattCharacteristicInfo): string {
  return `${characteristic.serviceUUID}|${characteristic.characteristicUUID}`;
}

function yesNo(value: boolean): string {
  return value ? 'sí' : 'no';
}

// Hace visibles CR y LF en consola sin modificar la respuesta almacenada.
function visibleAscii(value: string): string {
  return value.replace(/\r/g, '␍').replace(/\n/g, '␊');
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

// Asigna un color distinto a errores, operaciones TX y fragmentos RX.
function consoleColor(level: ConsoleEntry['level']) {
  switch (level) {
    case 'error':
      return styles.consoleError;
    case 'success':
      return styles.consoleSuccess;
    case 'rx':
      return styles.consoleRx;
    case 'tx':
      return styles.consoleTx;
    default:
      return undefined;
  }
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, backgroundColor: '#F4F7FA' },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#102A43',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#DCEEFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  statusText: { fontSize: 18, fontWeight: '700', color: '#0B4F82' },
  secondary: { color: '#486581', marginTop: 3 },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#102A43',
    marginBottom: 10,
  },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    backgroundColor: '#1367A7',
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 8,
  },
  compactButton: { paddingVertical: 6, paddingHorizontal: 10, marginBottom: 0 },
  dangerButton: { backgroundColor: '#B42318' },
  disabledButton: { opacity: 0.4 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  empty: { color: '#627D98', fontStyle: 'italic', marginVertical: 8 },
  deviceCard: {
    borderWidth: 1,
    borderColor: '#BCCCDC',
    borderRadius: 9,
    padding: 11,
    marginTop: 8,
  },
  selectedCard: { borderColor: '#1367A7', backgroundColor: '#EAF5FF' },
  deviceName: { fontWeight: '700', color: '#243B53', fontSize: 16 },
  mono: {
    fontFamily: 'monospace',
    color: '#334E68',
    fontSize: 12,
    marginTop: 3,
  },
  gattCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#7FB3D5',
    paddingLeft: 10,
    marginBottom: 12,
  },
  properties: { color: '#486581', lineHeight: 19, marginTop: 5 },
  label: {
    fontWeight: '700',
    color: '#243B53',
    marginTop: 10,
    marginBottom: 6,
  },
  help: { color: '#627D98', lineHeight: 19, marginBottom: 8 },
  choiceList: { marginBottom: 6 },
  choice: {
    borderWidth: 1,
    borderColor: '#BCCCDC',
    borderRadius: 8,
    padding: 9,
    marginBottom: 7,
  },
  selectedChoice: { borderColor: '#1367A7', backgroundColor: '#EAF5FF' },
  choiceTitle: {
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
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  console: {
    backgroundColor: '#102A43',
    borderRadius: 8,
    padding: 10,
    minHeight: 100,
  },
  consoleText: {
    fontFamily: 'monospace',
    color: '#D9E2EC',
    fontSize: 11,
    marginBottom: 5,
  },
  consoleError: { color: '#FFB4AB' },
  consoleSuccess: { color: '#A7F3D0' },
  consoleRx: { color: '#93C5FD' },
  consoleTx: { color: '#FDE68A' },
});
