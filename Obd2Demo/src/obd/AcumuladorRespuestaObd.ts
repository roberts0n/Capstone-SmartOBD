/* eslint-disable no-bitwise */
// react-native-ble-plx intercambia valores GATT como Base64. Estas funciones
// cubren solamente bytes y ASCII, que es lo que necesita el protocolo ELM327.
// Se implementan aqui para no agregar una dependencia externa por esta tarea.
const ALFABETO_BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Convierte bytes sin signo a Base64 en grupos de tres. */
export function bytesABase64(bytes: readonly number[]): string {
  let resultado = '';
  for (let indice = 0; indice < bytes.length; indice += 3) {
    const primero = bytes[indice];
    const segundo = bytes[indice + 1];
    const tercero = bytes[indice + 2];
    const agrupados = (primero << 16) | ((segundo ?? 0) << 8) | (tercero ?? 0);
    resultado += ALFABETO_BASE64[(agrupados >> 18) & 63];
    resultado += ALFABETO_BASE64[(agrupados >> 12) & 63];
    resultado +=
      segundo === undefined ? '=' : ALFABETO_BASE64[(agrupados >> 6) & 63];
    resultado += tercero === undefined ? '=' : ALFABETO_BASE64[agrupados & 63];
  }
  return resultado;
}

/** Convierte Base64 a los bytes originales y valida caracteres y longitud. */
export function base64ABytes(valor: string): number[] {
  const valorLimpio = valor.replace(/\s/g, '');
  if (valorLimpio.length % 4 !== 0) {
    throw new Error('Notificación Base64 inválida.');
  }

  const bytes: number[] = [];
  for (let indice = 0; indice < valorLimpio.length; indice += 4) {
    const caracteres = valorLimpio.slice(indice, indice + 4);
    const valores = caracteres
      .split('')
      .map(caracter =>
        caracter === '=' ? 0 : ALFABETO_BASE64.indexOf(caracter),
      );
    if (valores.some(valorEncontrado => valorEncontrado < 0)) {
      throw new Error('Notificación Base64 inválida.');
    }
    const agrupados =
      (valores[0] << 18) | (valores[1] << 12) | (valores[2] << 6) | valores[3];
    bytes.push((agrupados >> 16) & 255);
    if (caracteres[2] !== '=') {
      bytes.push((agrupados >> 8) & 255);
    }
    if (caracteres[3] !== '=') {
      bytes.push(agrupados & 255);
    }
  }
  return bytes;
}

/** Convierte un comando ASCII, incluido su retorno de carro, a Base64. */
export function asciiABase64(valor: string): string {
  return bytesABase64(Array.from(valor, caracter => caracter.charCodeAt(0)));
}

/**
 * Une notificaciones BLE que pueden llegar fragmentadas.
 *
 * ELM327 marca el final de una respuesta con el prompt ">". Una notificacion
 * no equivale necesariamente a una respuesta completa, por eso se acumulan
 * bytes hasta encontrar ese caracter.
 */
export class AcumuladorRespuestaObd {
  private bytes: number[] = [];

  /** Decodifica un fragmento y lo agrega al final del buffer. */
  agregarBase64(valorBase64: string): number[] {
    const recibidos = base64ABytes(valorBase64);
    this.bytes.push(...recibidos);
    return recibidos;
  }

  /** Indica si ya llego el prompt final de ELM327. */
  estaCompleta(): boolean {
    return this.bytes.includes('>'.charCodeAt(0));
  }

  /**
   * Extrae una respuesta hasta el primer prompt y conserva bytes posteriores.
   * Esto evita perder datos si un paquete contiene el final de una respuesta y
   * el comienzo de la siguiente.
   */
  consumir(): { textoAscii: string; bytes: number[] } {
    const indicePrompt = this.bytes.indexOf('>'.charCodeAt(0));
    const indiceFinal =
      indicePrompt >= 0 ? indicePrompt + 1 : this.bytes.length;
    const bytesRespuesta = this.bytes.slice(0, indiceFinal);
    this.bytes = this.bytes.slice(indiceFinal);
    return {
      textoAscii: String.fromCharCode(...bytesRespuesta),
      bytes: bytesRespuesta,
    };
  }

  /** Descarta fragmentos pendientes antes de un comando o una desconexion. */
  reiniciar(): void {
    this.bytes = [];
  }
}
