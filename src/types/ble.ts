import type { State } from 'react-native-ble-plx';

// Estados de alto nivel que la interfaz muestra al usuario. Son distintos del
// estado nativo de Bluetooth porque tambien representan conexion y busqueda.
export type ConnectionStatus =
  | 'idle'
  | 'bluetooth-unavailable'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

// Copia estable de los datos del dispositivo que necesita la interfaz. Evita
// acoplar la pantalla al objeto Device completo de react-native-ble-plx.
export interface BleDeviceInfo {
  id: string;
  name: string | null;
  localName: string | null;
  rssi: number | null;
}

// Inventario de una caracteristica descubierto en GATT. Estas propiedades se
// usan para formar las listas de candidatos TX y RX sin asumir UUID concretos.
export interface GattCharacteristicInfo {
  serviceUUID: string;
  characteristicUUID: string;
  isReadable: boolean;
  isWritableWithResponse: boolean;
  isWritableWithoutResponse: boolean;
  isNotifiable: boolean;
  isIndicatable: boolean;
}

// Entrada visible en la consola interna de diagnostico.
export interface ConsoleEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'rx' | 'tx';
  message: string;
}

// Respuesta ELM327 completa, conservada en texto y bytes para poder auditarla.
export interface ElmResponse {
  ascii: string;
  bytes: number[];
}

// Resultado de interpretar una respuesta OBD. El valor crudo se conserva por
// separado en ObdJsonResult incluso cuando la traduccion falla.
export interface ObdTranslation {
  value: number | string | string[] | null;
  unit: string | null;
  error: string | null;
}

// Formato sencillo mostrado en pantalla y pensado para integraciones futuras.
export interface ObdJsonResult {
  fecha: string;
  dispositivo: {
    nombre: string | null;
    identificador: string;
  } | null;
  comando: string;
  respuestaCruda: string | null;
  datoTraducido: number | string | string[] | null;
  unidad: string | null;
  erroresComunicacion: string[];
}

// Alias que permite exponer el estado de BLE sin importar State en la interfaz.
export type BluetoothState = State;
