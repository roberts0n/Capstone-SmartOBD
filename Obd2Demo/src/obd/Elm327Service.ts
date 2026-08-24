/* eslint-disable no-bitwise */
import type { Subscription } from 'react-native-ble-plx';
import type { BleService } from '../ble/BleService';
import type {
  ElmResponse,
  GattCharacteristicInfo,
  ObdTranslation,
} from '../types/ble';
import {
  asciiToBase64,
  base64ToBytes,
  ObdResponseBuffer,
} from './ObdResponseBuffer';

// Solo se permite un comando pendiente. Su promesa se resuelve cuando el
// buffer encuentra ">" o se rechaza por timeout, error BLE o cancelacion.
interface PendingCommand {
  resolve: (response: ElmResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface ElmNotificationHandlers {
  onChunk: (ascii: string, bytes: number[]) => void;
  onError: (error: Error) => void;
}

/**
 * Implementa el protocolo de texto ELM327 sobre un transporte BLE ya conectado.
 *
 * BleService se ocupa de GATT. Esta clase se ocupa de ASCII, retorno de carro,
 * fragmentos de respuesta, prompt final y espera de un comando a la vez.
 */
export class Elm327Service {
  private notificationSubscription: Subscription | null = null;
  private readonly responseBuffer = new ObdResponseBuffer();
  private pendingCommand: PendingCommand | null = null;

  constructor(private readonly bleService: BleService) {}

  /**
   * Activa RX sobre la caracteristica elegida por el usuario.
   * Cada fragmento se informa a la consola y tambien se agrega al buffer.
   */
  subscribe(
    deviceId: string,
    characteristic: GattCharacteristicInfo,
    handlers: ElmNotificationHandlers,
  ): void {
    this.unsubscribe();
    this.notificationSubscription = this.bleService.monitor(
      deviceId,
      characteristic,
      (error, base64Value) => {
        if (error) {
          const notificationError = new Error(error.message);
          handlers.onError(notificationError);
          this.rejectPending(notificationError);
          return;
        }
        if (!base64Value) {
          return;
        }
        try {
          // Se decodifica aqui para mostrar inmediatamente cada fragmento.
          const bytes = base64ToBytes(base64Value);
          const ascii = String.fromCharCode(...bytes);
          handlers.onChunk(ascii, bytes);
          this.responseBuffer.appendBase64(base64Value);
          // La promesa del comando no termina hasta recibir el prompt completo.
          if (this.pendingCommand && this.responseBuffer.isComplete()) {
            const response = this.responseBuffer.consume();
            const pending = this.pendingCommand;
            this.pendingCommand = null;
            clearTimeout(pending.timeout);
            pending.resolve(response);
          }
        } catch (caught) {
          const decodeError = toError(caught);
          handlers.onError(decodeError);
          this.rejectPending(decodeError);
        }
      },
    );
  }

  /** Permite a la pantalla comprobar si RX esta preparado. */
  isSubscribed(): boolean {
    return this.notificationSubscription !== null;
  }

  /**
   * Envia un comando y espera su respuesta completa.
   * El comando se normaliza, se agrega "\r" y luego se codifica como Base64.
   */
  async sendCommand(
    deviceId: string,
    writeCharacteristic: GattCharacteristicInfo,
    command: string,
    timeoutMs = 10000,
  ): Promise<ElmResponse> {
    if (!this.notificationSubscription) {
      throw new Error(
        'Suscríbete a la característica de notificación primero.',
      );
    }
    if (this.pendingCommand) {
      throw new Error('Ya existe un comando ELM327 pendiente.');
    }

    const normalizedCommand = command.trim().toUpperCase();
    this.responseBuffer.reset();
    // El timeout evita dejar la interfaz bloqueada si el canal RX es incorrecto
    // o si el adaptador deja de responder.
    const responsePromise = new Promise<ElmResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommand = null;
        reject(
          new Error(
            `Tiempo agotado esperando el prompt > para ${normalizedCommand}.`,
          ),
        );
      }, timeoutMs);
      this.pendingCommand = { resolve, reject, timeout };
    });

    try {
      await this.bleService.write(
        deviceId,
        writeCharacteristic,
        asciiToBase64(`${normalizedCommand}\r`),
      );
    } catch (caught) {
      this.rejectPending(toError(caught));
      throw caught;
    }
    return responsePromise;
  }

  /** Cancela RX y cualquier comando que aun este esperando una respuesta. */
  unsubscribe(): void {
    this.notificationSubscription?.remove();
    this.notificationSubscription = null;
    this.responseBuffer.reset();
    this.rejectPending(new Error('Suscripción ELM327 cancelada.'));
  }

  private rejectPending(error: Error): void {
    if (!this.pendingCommand) {
      return;
    }
    const pending = this.pendingCommand;
    this.pendingCommand = null;
    clearTimeout(pending.timeout);
    pending.reject(error);
  }
}

/**
 * Traduce solamente los comandos OBD requeridos por la demo.
 * Siempre se mantiene la respuesta cruda fuera de esta funcion.
 */
export function translateObdResponse(
  command: string,
  rawResponse: string,
): ObdTranslation {
  const bytes = extractHexBytes(rawResponse);
  const normalizedCommand = command.trim().toUpperCase();

  if (normalizedCommand === '010C') {
    // Respuesta esperada: 41 0C A B. Formula: ((A * 256) + B) / 4.
    const index = findSequence(bytes, [0x41, 0x0c]);
    if (index < 0 || bytes.length < index + 4) {
      return translationError('No se encontró una respuesta válida 41 0C.');
    }
    return {
      value: (bytes[index + 2] * 256 + bytes[index + 3]) / 4,
      unit: 'rpm',
      error: null,
    };
  }

  if (normalizedCommand === '0105') {
    // Respuesta esperada: 41 05 A. Formula: A - 40 grados Celsius.
    const index = findSequence(bytes, [0x41, 0x05]);
    if (index < 0 || bytes.length < index + 3) {
      return translationError('No se encontró una respuesta válida 41 05.');
    }
    return { value: bytes[index + 2] - 40, unit: '°C', error: null };
  }

  if (normalizedCommand === '03') {
    // El modo 03 responde con 43 seguido por pares de bytes que forman DTC.
    const index = bytes.indexOf(0x43);
    if (index < 0) {
      return translationError('No se encontró una respuesta válida 43.');
    }
    const codes: string[] = [];
    for (let cursor = index + 1; cursor + 1 < bytes.length; cursor += 2) {
      const first = bytes[cursor];
      const second = bytes[cursor + 1];
      if (first === 0 && second === 0) {
        continue;
      }
      // Los dos bits superiores eligen P, C, B o U. Los bits restantes
      // producen los cuatro digitos del codigo, por ejemplo P0133.
      const system = ['P', 'C', 'B', 'U'][(first >> 6) & 3];
      codes.push(
        `${system}${((first >> 4) & 3).toString(16)}${(first & 15).toString(
          16,
        )}${((second >> 4) & 15).toString(16)}${(second & 15).toString(
          16,
        )}`.toUpperCase(),
      );
    }
    return { value: codes, unit: 'DTC', error: null };
  }

  return { value: rawResponse.trim(), unit: null, error: null };
}

// Acepta respuestas con espacios ("41 0C 0C 5C") y sin espacios
// ("410C0C5C"). Tambien tolera que ELM327 repita el comando enviado.
function extractHexBytes(response: string): number[] {
  const runs =
    response.toUpperCase().match(/[0-9A-F]{2}(?:\s*[0-9A-F]{2})+/g) ?? [];
  return runs.flatMap(run => {
    const compact = run.replace(/\s/g, '');
    const bytes: number[] = [];
    for (let index = 0; index + 1 < compact.length; index += 2) {
      bytes.push(Number.parseInt(compact.slice(index, index + 2), 16));
    }
    return bytes;
  });
}

/** Busca la posicion de una cabecera como 41 0C dentro de todos los bytes. */
function findSequence(
  values: readonly number[],
  expected: readonly number[],
): number {
  return values.findIndex((_, index) =>
    expected.every((value, offset) => values[index + offset] === value),
  );
}

function translationError(message: string): ObdTranslation {
  return { value: null, unit: null, error: message };
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
