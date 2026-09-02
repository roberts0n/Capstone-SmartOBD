/* eslint-disable no-bitwise */
export const CATEGORIAS_DTC = {
  '03': { nombre: 'Almacenados / confirmados', respuesta: 0x43 },
  '07': { nombre: 'Pendientes', respuesta: 0x47 },
  '0A': { nombre: 'Permanentes', respuesta: 0x4a },
} as const;

export type ComandoDtc = keyof typeof CATEGORIAS_DTC;
export interface ContextoDtc {
  protocolo: string | null;
  cabeceras: boolean | null;
}
export type EstadoDtc =
  | 'con-codigos'
  | 'sin-codigos'
  | 'parcial'
  | 'sin-datos'
  | 'no-soportado'
  | 'respuesta-negativa'
  | 'invalida'
  | 'protocolo-desconocido';

export interface MensajeDtc {
  ecu: string | null;
  lineas: number[];
  carga: number[];
  cantidadDeclarada: number | null;
  codigos: string[];
  estado: EstadoDtc;
  advertencias: string[];
}

export interface ResultadoDtc {
  comando: ComandoDtc;
  categoria: string;
  estado: EstadoDtc;
  codigos: string[];
  mensajes: MensajeDtc[];
  advertencias: string[];
}

interface CargaObd {
  ecu: string | null;
  lineas: number[];
  bytes: number[];
}
interface Ensamblado extends CargaObd {
  longitud: number;
  siguiente: number;
}

export function esComandoDtc(comando: string): comando is ComandoDtc {
  return Object.prototype.hasOwnProperty.call(CATEGORIAS_DTC, comando);
}

/** ATDPN puede devolver A6: A significa seleccion automatica, 6 es CAN. */
export function numeroProtocolo(respuesta: string | null): number | null {
  const valor = respuesta?.replace(/AT\s*DPN/gi, '').replace(/[>\s]/g, '');
  const coincidencia = valor?.toUpperCase().match(/^A?([1-9A-C])$/);
  return coincidencia ? Number.parseInt(coincidencia[1], 16) : null;
}

export function decodificarDtc(primero: number, segundo: number): string {
  const sistema = ['P', 'C', 'B', 'U'][(primero >> 6) & 3];
  return `${sistema}${(primero >> 4) & 3}${(primero & 15).toString(16)}${segundo
    .toString(16)
    .padStart(2, '0')}`.toUpperCase();
}

/** Funcion pura: no consulta BLE, no cambia la captura y no adivina el protocolo. */
export function interpretarDtc(
  comando: ComandoDtc,
  respuesta: string,
  contexto: ContextoDtc,
): ResultadoDtc {
  const protocolo = numeroProtocolo(contexto.protocolo);
  const can = protocolo !== null && protocolo >= 6 && protocolo <= 9;
  const advertencias: string[] = [];
  const cargas: CargaObd[] = [];
  const pendientes = new Map<string, Ensamblado>();
  let formateado: Ensamblado | null = null;
  let longitudFormateada: number | null = null;
  let sinDatos = false;
  let noSoportado = false;
  let bloquesAmbiguos = false;
  const textos = respuesta.replace(/>/g, '').split(/[\r\n]+/);

  function advertir(numero: number, mensaje: string) {
    advertencias.push(`Linea ${numero}: ${mensaje}`);
  }

  for (let indice = 0; indice < textos.length; indice += 1) {
    const linea = indice + 1;
    const texto = textos[indice].trim().toUpperCase();
    if (
      !texto ||
      texto.replace(/\s/g, '') === comando ||
      /^SEARCHING\.*$/.test(texto)
    ) {
      continue;
    }
    if (texto === 'NO DATA') {
      sinDatos = true;
      continue;
    }
    if (texto === '?') {
      noSoportado = true;
      continue;
    }

    // Sin ID de ECU solo un bloque numerado completo y ordenado es interpretable.
    if (can && contexto.cabeceras === false && /^[0-9A-F]{3}$/.test(texto)) {
      if (formateado || longitudFormateada !== null) {
        bloquesAmbiguos = true;
        advertir(
          linea,
          'Bloques sin cabecera intercalados o incompletos; repetir con ATH1.',
        );
      }
      formateado = null;
      longitudFormateada = Number.parseInt(texto, 16);
      continue;
    }
    const etiqueta = texto.match(/^([0-9A-F]):\s*(.*)$/);
    if (etiqueta) {
      const bytes = leerBytes(etiqueta[2]);
      const secuencia = Number.parseInt(etiqueta[1], 16);
      if (!can || contexto.cabeceras !== false || !bytes) {
        advertir(linea, 'Bloque numerado sin contexto CAN valido.');
        continue;
      }
      if (longitudFormateada !== null && secuencia === 0) {
        formateado = {
          ecu: null,
          lineas: [],
          bytes: [],
          longitud: longitudFormateada,
          siguiente: 0,
        };
        longitudFormateada = null;
      }
      if (!formateado || secuencia !== formateado.siguiente) {
        bloquesAmbiguos = true;
        advertir(
          linea,
          'Secuencia de bloques invalida; no se unen datos de origen incierto.',
        );
        formateado = null;
        continue;
      }
      formateado.bytes.push(...bytes);
      formateado.lineas.push(linea);
      formateado.siguiente = (secuencia + 1) & 15;
      if (formateado.bytes.length >= formateado.longitud) {
        if (formateado.bytes.length !== formateado.longitud) {
          advertir(linea, 'La longitud del bloque formateado no coincide.');
        } else {
          cargas.push(formateado);
        }
        formateado = null;
      }
      continue;
    }

    let ecu: string | null = null;
    let datos = texto;
    const conId = texto.match(/^([0-9A-F]{3}|[0-9A-F]{8})\s+(.+)$/);
    if (conId) {
      ecu = conId[1];
      // D1 puede mostrar DLC como un token de un digito; no es parte del payload.
      datos = conId[2].replace(/^[0-8]\s+(?=[0-9A-F]{2}(?:\s|$))/, '');
    }
    let bytes = leerBytes(datos);
    if (!bytes) {
      advertir(linea, `Texto o formato no reconocido: ${texto}`);
      continue;
    }
    if (!can) {
      if (ecu) {
        advertir(
          linea,
          'Cabecera CAN incompatible con el protocolo registrado.',
        );
        continue;
      }
      if (contexto.cabeceras === true) {
        // ISO/J1850: tres bytes de cabecera y un checksum. KWP puede extender longitud.
        const longitudCabecera =
          protocolo === 4 || protocolo === 5
            ? (bytes[0] & 63) === 0
              ? 4
              : 3
            : 3;
        if (protocolo === null || bytes.length < longitudCabecera + 2) {
          advertir(
            linea,
            'Cabecera no CAN incompleta o protocolo desconocido.',
          );
          continue;
        }
        if (
          (protocolo === 4 || protocolo === 5) &&
          ((bytes[0] & 0x80) === 0 ||
            (bytes[0] & 63 || bytes[3]) !== bytes.length - longitudCabecera - 1)
        ) {
          advertir(linea, 'Longitud o formato de cabecera KWP no reconocido.');
          continue;
        }
        ecu = bytes.slice(0, longitudCabecera).map(aHex).join(' ');
        if (protocolo >= 3 && protocolo <= 5) {
          const suma =
            bytes.slice(0, -1).reduce((total, byte) => total + byte, 0) & 255;
          if (suma !== bytes[bytes.length - 1]) {
            advertir(linea, 'Checksum ISO/KWP incorrecto.');
            continue;
          }
        }
        bytes = bytes.slice(longitudCabecera, -1);
      }
      cargas.push({ ecu, lineas: [linea], bytes });
      continue;
    }

    // Algunos adaptadores separan los cuatro bytes del identificador CAN de 29 bits.
    if (
      !ecu &&
      contexto.cabeceras === true &&
      (protocolo === 8 || protocolo === 9) &&
      bytes.length >= 5
    ) {
      ecu = bytes.slice(0, 4).map(aHex).join('');
      bytes = bytes.slice(4);
    }
    if (!ecu) {
      if (contexto.cabeceras !== false) {
        advertir(
          linea,
          'Falta la cabecera CAN esperada; no se interpreta a ciegas.',
        );
      } else {
        cargas.push({ ecu: null, lineas: [linea], bytes });
      }
      continue;
    }
    const tipo = bytes[0] >> 4;
    if (tipo === 0) {
      const longitud = bytes[0] & 15;
      if (pendientes.has(ecu)) {
        advertir(linea, `Mensaje anterior de ${ecu} incompleto.`);
        pendientes.delete(ecu);
      }
      if (longitud < 1 || longitud > 7 || bytes.length < longitud + 1) {
        advertir(linea, 'Longitud de trama CAN simple invalida.');
      } else {
        cargas.push({
          ecu,
          lineas: [linea],
          bytes: bytes.slice(1, longitud + 1),
        });
      }
    } else if (tipo === 1) {
      const longitud = ((bytes[0] & 15) << 8) | bytes[1];
      if (pendientes.has(ecu)) {
        advertir(linea, `Nueva trama inicial antes de completar ${ecu}.`);
      }
      if (bytes.length !== 8 || longitud <= 7) {
        advertir(linea, 'Trama inicial CAN invalida.');
        pendientes.delete(ecu);
      } else {
        pendientes.set(ecu, {
          ecu,
          lineas: [linea],
          bytes: bytes.slice(2),
          longitud,
          siguiente: 1,
        });
      }
    } else if (tipo === 2) {
      const pendiente = pendientes.get(ecu);
      if (
        !pendiente ||
        (bytes[0] & 15) !== pendiente.siguiente ||
        bytes.length < 2 ||
        bytes.length > 8
      ) {
        advertir(linea, `Continuacion CAN fuera de secuencia para ${ecu}.`);
        pendientes.delete(ecu);
        continue;
      }
      pendiente.bytes.push(...bytes.slice(1));
      pendiente.lineas.push(linea);
      pendiente.siguiente = (pendiente.siguiente + 1) & 15;
      if (pendiente.bytes.length < pendiente.longitud && bytes.length !== 8) {
        advertir(
          linea,
          'Trama de continuacion CAN intermedia demasiado corta.',
        );
        pendientes.delete(ecu);
        continue;
      }
      if (pendiente.bytes.length >= pendiente.longitud) {
        cargas.push({
          ...pendiente,
          bytes: pendiente.bytes.slice(0, pendiente.longitud),
        });
        pendientes.delete(ecu);
      }
    } else {
      advertir(linea, 'PCI CAN no reconocido para una respuesta diagnostica.');
    }
  }
  if (formateado || longitudFormateada !== null || pendientes.size > 0) {
    advertencias.push(
      'Respuesta multitrama incompleta; se conserva cruda sin inventar DTC.',
    );
  }

  if (protocolo === null || protocolo > 9) {
    return {
      comando,
      categoria: CATEGORIAS_DTC[comando].nombre,
      estado: 'protocolo-desconocido',
      codigos: [],
      mensajes: [],
      advertencias: [
        'Se requiere un protocolo OBD 1-9 confirmado mediante ATDPN.',
        ...advertencias,
      ],
    };
  }
  if (!respuesta.includes('>')) {
    advertencias.push('No se recibio el prompt final; captura incompleta.');
  }
  const mensajes = cargas
    .filter(
      carga =>
        !(bloquesAmbiguos && carga.ecu === null && carga.lineas.length > 1),
    )
    .map(carga => interpretarCarga(comando, carga, can));
  const validos = mensajes.filter(
    mensaje =>
      mensaje.estado === 'con-codigos' || mensaje.estado === 'sin-codigos',
  );
  const codigos = [...new Set(validos.flatMap(mensaje => mensaje.codigos))];
  const problemas =
    advertencias.length > 0 ||
    mensajes.some(mensaje => !validos.includes(mensaje)) ||
    sinDatos ||
    noSoportado;
  let estado: EstadoDtc;
  if (validos.length > 0) {
    estado = problemas
      ? 'parcial'
      : codigos.length > 0
      ? 'con-codigos'
      : 'sin-codigos';
  } else if (advertencias.length > 0) {
    estado = 'invalida';
  } else if (mensajes.length > 0) {
    estado = mensajes.some(mensaje => mensaje.estado === 'invalida')
      ? 'invalida'
      : mensajes.every(mensaje => mensaje.estado === 'no-soportado')
      ? 'no-soportado'
      : 'respuesta-negativa';
  } else {
    estado = noSoportado ? 'no-soportado' : sinDatos ? 'sin-datos' : 'invalida';
  }
  return {
    comando,
    categoria: CATEGORIAS_DTC[comando].nombre,
    estado,
    codigos,
    mensajes,
    advertencias: [
      ...advertencias,
      ...mensajes.flatMap(mensaje => mensaje.advertencias),
    ],
  };
}

function interpretarCarga(
  comando: ComandoDtc,
  carga: CargaObd,
  can: boolean,
): MensajeDtc {
  const { bytes } = carga;
  const resultado: MensajeDtc = {
    ecu: carga.ecu,
    lineas: carga.lineas,
    carga: bytes,
    cantidadDeclarada: null,
    codigos: [],
    estado: 'invalida',
    advertencias: [],
  };
  const fallar = (mensaje: string) => {
    resultado.codigos = [];
    resultado.advertencias.push(mensaje);
    return resultado;
  };
  if (
    bytes[0] === 0x7f &&
    bytes[1] === Number.parseInt(comando, 16) &&
    bytes.length >= 3
  ) {
    resultado.estado = [0x11, 0x12].includes(bytes[2])
      ? 'no-soportado'
      : 'respuesta-negativa';
    resultado.advertencias.push(
      `ECU ${carga.ecu ?? 'sin cabecera'}: respuesta negativa NRC ${aHex(
        bytes[2],
      )}.`,
    );
    return resultado;
  }
  if (bytes[0] !== CATEGORIAS_DTC[comando].respuesta) {
    return fallar(
      'El servicio de respuesta no corresponde al comando enviado.',
    );
  }
  let datos = bytes.slice(1);
  if (can) {
    if (datos.length === 0) {
      return fallar('Falta el contador DTC CAN.');
    }
    const cantidad = datos[0];
    resultado.cantidadDeclarada = cantidad;
    datos = datos.slice(1);
    if (datos.length < cantidad * 2) {
      return fallar('El contador CAN declara mas DTC que los bytes recibidos.');
    }
    if (datos.slice(cantidad * 2).some(byte => byte !== 0)) {
      return fallar('Existen bytes no nulos despues de los DTC declarados.');
    }
    datos = datos.slice(0, cantidad * 2);
  } else if (datos.length === 0 || datos.length % 2 !== 0) {
    return fallar('Cantidad de bytes DTC no CAN incompleta.');
  }
  for (let indice = 0; indice < datos.length; indice += 2) {
    if (datos[indice] === 0 && datos[indice + 1] === 0) {
      if (can) {
        return fallar('El contador CAN incluye un DTC nulo.');
      }
      continue;
    }
    resultado.codigos.push(decodificarDtc(datos[indice], datos[indice + 1]));
  }
  resultado.estado =
    resultado.codigos.length > 0 ? 'con-codigos' : 'sin-codigos';
  return resultado;
}

function leerBytes(texto: string): number[] | null {
  const compacto = texto.replace(/\s/g, '');
  if (!/^(?:[0-9A-F]{2})+$/.test(compacto)) {
    return null;
  }
  return (compacto.match(/../g) ?? []).map(byte => Number.parseInt(byte, 16));
}
function aHex(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}
