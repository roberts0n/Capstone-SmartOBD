import type { State } from 'react-native-ble-plx';

// Estados de alto nivel que la interfaz muestra al usuario. Son distintos del
// estado nativo de Bluetooth porque tambien representan conexion y busqueda.
export type EstadoConexion =
  | 'listo'
  | 'bluetooth-no-disponible'
  | 'buscando'
  | 'conectando'
  | 'conectado'
  | 'desconectado'
  | 'error';

// Copia estable de los datos del dispositivo que necesita la interfaz. Evita
// acoplar la pantalla al objeto Device completo de react-native-ble-plx.
export interface InformacionDispositivoBle {
  id: string;
  nombre: string | null;
  nombreLocal: string | null;
  rssi: number | null;
  // Datos del anuncio, no del inventario GATT obtenido despues de conectar.
  serviciosAnunciados?: string[] | null;
  datosFabricante?: string | null;
}

// Inventario de una caracteristica descubierto en GATT. Estas propiedades se
// usan para formar las listas de candidatos TX y RX sin asumir UUID concretos.
export interface InformacionCaracteristicaGatt {
  uuidServicio: string;
  uuidCaracteristica: string;
  permiteLectura: boolean;
  permiteEscrituraConRespuesta: boolean;
  permiteEscrituraSinRespuesta: boolean;
  permiteNotificacion: boolean;
  permiteIndicacion: boolean;
}

// Entrada visible en la consola interna de diagnostico.
export interface EntradaConsola {
  id: number;
  marcaTiempo: string;
  nivel: 'informacion' | 'exito' | 'error' | 'rx' | 'tx';
  mensaje: string;
}

// Respuesta ELM327 completa, conservada en texto y bytes para poder auditarla.
export interface MetricasRecepcionElm {
  inicioComandoMs: number;
  escrituraBleCompletaMs: number | null;
  primerFragmentoMs: number | null;
  respuestaCompletaMs: number | null;
  cantidadFragmentos: number;
  cantidadBytes: number;
}

export interface RespuestaElm {
  textoAscii: string;
  bytes: number[];
  metricasRecepcion: MetricasRecepcionElm;
}

// Resultado de interpretar una respuesta OBD. El valor crudo se conserva por
// separado en ResultadoJsonObd incluso cuando la traduccion falla.
export interface TraduccionObd {
  valor: number | string | string[] | ResultadoDeteccionPids | null;
  unidad: string | null;
  error: string | null;
}

export interface BloquePidsDetectado {
  comando: string;
  mascaraHexadecimal: string;
  pidsDeclarados: string[];
}

export interface ResultadoDeteccionPids {
  cantidadPidsSoportados: number;
  cantidadInterpretables: number;
  cantidadPendientes: number;
  pidsSoportados: string[];
  pidsInterpretables: string[];
  pidsPendientes: string[];
  bloques: BloquePidsDetectado[];
}

// Formato sencillo mostrado en pantalla y pensado para integraciones futuras.
export interface ResultadoJsonObd {
  fecha: string;
  dispositivo: {
    nombre: string | null;
    identificador: string;
  } | null;
  comando: string;
  respuestaCruda: string | null;
  datoTraducido: number | string | string[] | ResultadoDeteccionPids | null;
  unidad: string | null;
  erroresComunicacion: string[];
}

// Duraciones calculadas para observar el flujo completo en la pantalla demo.
export interface MetricasFlujoObd {
  comando: string;
  escrituraBleMs: number | null;
  latenciaPrimerFragmentoMs: number | null;
  recepcionFragmentosMs: number | null;
  respuestaCompletaMs: number;
  traduccionObdMs: number;
  construccionResultadoMs: number;
  serializacionJsonMs: number;
  desdePrimerFragmentoHastaJsonMs: number | null;
  totalHastaJsonMs: number;
  cantidadFragmentos: number;
  cantidadBytes: number;
}

// Alias que permite exponer el estado de BLE sin importar State en la interfaz.
export type EstadoBluetooth = State;
