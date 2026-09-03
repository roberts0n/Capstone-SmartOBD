export interface RespuestaPidExtraida {
  cabecera: string | null;
  datos: number[];
}

/** Extrae mensajes individuales. Nunca busca 41 dentro de datos o une dos ECU. */
export function extraerRespuestasPid(
  respuesta: string,
  pid: number,
): RespuestaPidExtraida[] {
  const resultados: RespuestaPidExtraida[] = [];
  for (const original of respuesta.replace(/>/g, '').split(/[\r\n]+/)) {
    let texto = original.trim().toUpperCase();
    let cabecera: string | null = null;
    const partes = texto.split(/\s+/);
    if (/^[0-9A-F]{3}$/.test(partes[0]) && partes.length > 1) {
      cabecera = partes.shift()!;
      // Algunas configuraciones ELM muestran DLC como un digito aparte.
      if (/^[0-8]$/.test(partes[0])) {
        partes.shift();
      }
      texto = partes.join('');
    } else if (/^[0-9A-F]{8}$/.test(partes[0]) && partes.length > 1) {
      cabecera = partes.shift()!;
      if (/^[0-8]$/.test(partes[0])) {
        partes.shift();
      }
      texto = partes.join('');
    } else {
      texto = partes.join('');
      if (
        /^[0-9A-F]+$/.test(texto) &&
        texto.length % 2 === 1 &&
        texto.length >= 9
      ) {
        cabecera = texto.slice(0, 3);
        texto = texto.slice(3);
      } else if (/^18DA[0-9A-F]{4}/.test(texto)) {
        cabecera = texto.slice(0, 8);
        texto = texto.slice(8);
      }
    }
    if (!/^(?:[0-9A-F]{2})+$/.test(texto)) {
      continue;
    }
    let bytes = texto.match(/../g)!.map(byte => Number.parseInt(byte, 16));
    if (bytes[0] >= 2 && bytes[0] <= 7 && bytes[1] === 0x41) {
      const longitud = bytes[0];
      if (bytes.length < longitud + 1) {
        continue;
      }
      bytes = bytes.slice(1, longitud + 1);
    } else if (!cabecera && bytes[3] === 0x41 && bytes.length >= 7) {
      // Cabeceras ISO 9141/J1850/KWP de tres bytes. Se excluye el checksum.
      cabecera = bytes
        .slice(0, 3)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      bytes = bytes.slice(3, -1);
    }
    if (bytes[0] === 0x41 && bytes[1] === pid) {
      resultados.push({ cabecera, datos: bytes.slice(2) });
    }
  }
  return resultados;
}
