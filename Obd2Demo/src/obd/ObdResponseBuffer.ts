/* eslint-disable no-bitwise */
// react-native-ble-plx intercambia valores GATT como Base64. Estas funciones
// cubren solamente bytes y ASCII, que es lo que necesita el protocolo ELM327.
// Se implementan aqui para no agregar una dependencia externa por esta tarea.
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Convierte bytes sin signo a Base64 en grupos de tres. */
export function bytesToBase64(bytes: readonly number[]): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const packed = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += BASE64_ALPHABET[(packed >> 18) & 63];
    output += BASE64_ALPHABET[(packed >> 12) & 63];
    output += second === undefined ? '=' : BASE64_ALPHABET[(packed >> 6) & 63];
    output += third === undefined ? '=' : BASE64_ALPHABET[packed & 63];
  }
  return output;
}

/** Convierte Base64 a los bytes originales y valida caracteres y longitud. */
export function base64ToBytes(value: string): number[] {
  const clean = value.replace(/\s/g, '');
  if (clean.length % 4 !== 0) {
    throw new Error('Notificación Base64 inválida.');
  }

  const bytes: number[] = [];
  for (let index = 0; index < clean.length; index += 4) {
    const chars = clean.slice(index, index + 4);
    const values = chars
      .split('')
      .map(character =>
        character === '=' ? 0 : BASE64_ALPHABET.indexOf(character),
      );
    if (values.some(item => item < 0)) {
      throw new Error('Notificación Base64 inválida.');
    }
    const packed =
      (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];
    bytes.push((packed >> 16) & 255);
    if (chars[2] !== '=') {
      bytes.push((packed >> 8) & 255);
    }
    if (chars[3] !== '=') {
      bytes.push(packed & 255);
    }
  }
  return bytes;
}

/** Convierte un comando ASCII, incluido su retorno de carro, a Base64. */
export function asciiToBase64(value: string): string {
  return bytesToBase64(Array.from(value, character => character.charCodeAt(0)));
}

/**
 * Une notificaciones BLE que pueden llegar fragmentadas.
 *
 * ELM327 marca el final de una respuesta con el prompt ">". Una notificacion
 * no equivale necesariamente a una respuesta completa, por eso se acumulan
 * bytes hasta encontrar ese caracter.
 */
export class ObdResponseBuffer {
  private bytes: number[] = [];

  /** Decodifica un fragmento y lo agrega al final del buffer. */
  appendBase64(base64Value: string): number[] {
    const received = base64ToBytes(base64Value);
    this.bytes.push(...received);
    return received;
  }

  /** Indica si ya llego el prompt final de ELM327. */
  isComplete(): boolean {
    return this.bytes.includes('>'.charCodeAt(0));
  }

  /**
   * Extrae una respuesta hasta el primer prompt y conserva bytes posteriores.
   * Esto evita perder datos si un paquete contiene el final de una respuesta y
   * el comienzo de la siguiente.
   */
  consume(): { ascii: string; bytes: number[] } {
    const promptIndex = this.bytes.indexOf('>'.charCodeAt(0));
    const endIndex = promptIndex >= 0 ? promptIndex + 1 : this.bytes.length;
    const responseBytes = this.bytes.slice(0, endIndex);
    this.bytes = this.bytes.slice(endIndex);
    return {
      ascii: String.fromCharCode(...responseBytes),
      bytes: responseBytes,
    };
  }

  /** Descarta fragmentos pendientes antes de un comando o una desconexion. */
  reset(): void {
    this.bytes = [];
  }
}
