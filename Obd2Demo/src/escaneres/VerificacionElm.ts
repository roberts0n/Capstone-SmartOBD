import type {
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
} from '../tipos/ble';
import type { CanalEscaner, EscanerGuardado } from '../tipos/escaner';
import { normalizarUuid } from './PerfilesEscaner';

export interface CombinacionCanalesElm {
  escritura: InformacionCaracteristicaGatt;
  notificacion: InformacionCaracteristicaGatt;
  descripcion: string;
}

interface OperacionesVerificacion {
  sigueVigente: () => boolean;
  probar: (canales: CombinacionCanalesElm) => Promise<string>;
  alIntentar: (mensaje: string) => void;
}

// pruebo primero lo que funciono antes, pero no lo doy por valido sin consultar ATI
export async function verificarCanalesElm(
  dispositivo: InformacionDispositivoBle,
  caracteristicas: InformacionCaracteristicaGatt[],
  guardado: EscanerGuardado | undefined,
  operaciones: OperacionesVerificacion,
): Promise<{
  registro: EscanerGuardado;
  canales: CombinacionCanalesElm;
  respuestaAti: string;
}> {
  const anteriores = guardado && recuperarCanales(guardado, caracteristicas);
  const candidatos = [
    ...(anteriores
      ? [{ ...anteriores, descripcion: 'canales guardados' }]
      : []),
    ...obtenerCombinacionesAutomaticas(caracteristicas),
  ];
  const probados = new Set<string>();
  const comprobar = () => {
    if (!operaciones.sigueVigente())
      throw new Error('Preparación del escáner cancelada.');
  };
  let ultimoError = 'El escáner no tiene canales automáticos compatibles.';
  for (const canales of candidatos) {
    comprobar();
    const clave = [canales.escritura, canales.notificacion]
      .map(
        canal =>
          `${normalizarUuid(canal.uuidServicio)}|${normalizarUuid(
            canal.uuidCaracteristica,
          )}`,
      )
      .join('/');
    if (probados.has(clave)) continue;
    probados.add(clave);
    operaciones.alIntentar(`Verificando ${canales.descripcion}…`);
    try {
      const respuesta = await operaciones.probar(canales);
      comprobar();
      return {
        registro: crearEscanerVerificado(
          dispositivo,
          canales.escritura,
          canales.notificacion,
          respuesta,
        ),
        canales,
        respuestaAti: respuesta,
      };
    } catch (capturado) {
      comprobar();
      ultimoError =
        capturado instanceof Error ? capturado.message : String(capturado);
    }
  }
  throw new Error(`No se pudo verificar el escáner. ${ultimoError}`);
}

const PRIORIDADES_AUTOMATICAS = [
  { escritura: 'FFF1', notificacion: 'FFF1' },
  { escritura: 'FFF2', notificacion: 'FFF1' },
] as const;

/**
 * Forma solamente las combinaciones seriales conocidas que acordamos probar.
 * No escribe al azar sobre otras caracteristicas GATT del dispositivo.
 */
export function obtenerCombinacionesAutomaticas(
  caracteristicas: readonly InformacionCaracteristicaGatt[],
): CombinacionCanalesElm[] {
  const escribibles = caracteristicas.filter(
    elemento =>
      elemento.permiteEscrituraConRespuesta ||
      elemento.permiteEscrituraSinRespuesta,
  );
  const notificables = caracteristicas.filter(
    elemento => elemento.permiteNotificacion || elemento.permiteIndicacion,
  );
  const combinaciones: CombinacionCanalesElm[] = [];

  for (const prioridad of PRIORIDADES_AUTOMATICAS) {
    for (const escritura of escribibles) {
      if (!esUuidCorto(escritura.uuidCaracteristica, prioridad.escritura)) {
        continue;
      }
      for (const notificacion of notificables) {
        if (
          esUuidCorto(
            notificacion.uuidCaracteristica,
            prioridad.notificacion,
          ) &&
          normalizarUuid(escritura.uuidServicio) ===
            normalizarUuid(notificacion.uuidServicio)
        ) {
          combinaciones.push({
            escritura,
            notificacion,
            descripcion: `${prioridad.escritura} -> ${prioridad.notificacion}`,
          });
        }
      }
    }
  }

  return combinaciones;
}

function esUuidCorto(uuid: string, esperado: string): boolean {
  return normalizarUuid(uuid).startsWith(
    `0000${esperado.toLowerCase()}-0000-1000-8000-00805f9b34fb`,
  );
}

/** Verifica la identificacion ATI, no el vehiculo ni la autenticidad del chip. */
export function identificarElm(respuesta: string): string | null {
  if (!respuesta.trimEnd().endsWith('>')) {
    return null;
  }
  const lineas = respuesta
    .replace(/>/g, '')
    .split(/[\r\n]+/)
    .map(linea => linea.trim())
    .filter(linea => linea && !/^AT\s*I$/i.test(linea));
  // Rechazar OK, eco, errores y texto que solo mencione ELM327 en una frase.
  if (lineas.length !== 1) {
    return null;
  }
  return /^(?:ELM327\s+v?\d+\.\d+[a-z0-9. -]*|STN\d{4}\s+v?\d+\.\d+[a-z0-9. -]*)$/i.test(
    lineas[0],
  )
    ? lineas[0]
    : null;
}

export function crearEscanerVerificado(
  dispositivo: InformacionDispositivoBle,
  escritura: InformacionCaracteristicaGatt,
  notificacion: InformacionCaracteristicaGatt,
  respuestaAti: string,
): EscanerGuardado {
  const identificacionElm = identificarElm(respuestaAti);
  if (!identificacionElm) {
    throw new Error(
      'ATI no devolvió una identificación ELM327/STN reconocida. No se guardó el dispositivo; no implica que sea incompatible.',
    );
  }
  if (
    !(
      escritura.permiteEscrituraConRespuesta ||
      escritura.permiteEscrituraSinRespuesta
    ) ||
    !(notificacion.permiteNotificacion || notificacion.permiteIndicacion)
  ) {
    throw new Error(
      'Los canales seleccionados no permiten escritura y recepción.',
    );
  }
  const canal = (elemento: CanalEscaner): CanalEscaner => ({
    uuidServicio: normalizarUuid(elemento.uuidServicio),
    uuidCaracteristica: normalizarUuid(elemento.uuidCaracteristica),
  });
  return {
    id: dispositivo.id,
    nombre: dispositivo.nombre,
    nombreLocal: dispositivo.nombreLocal,
    identificacionElm,
    verificadoEn: new Date().toISOString(),
    escritura: canal(escritura),
    notificacion: canal(notificacion),
  };
}

/** Restaura solo UUID y propiedades presentes en el inventario GATT actual. */
export function recuperarCanales(
  guardado: EscanerGuardado,
  caracteristicas: InformacionCaracteristicaGatt[],
): {
  escritura: InformacionCaracteristicaGatt;
  notificacion: InformacionCaracteristicaGatt;
} | null {
  const coincide = (actual: CanalEscaner, previo: CanalEscaner) =>
    normalizarUuid(actual.uuidServicio) ===
      normalizarUuid(previo.uuidServicio) &&
    normalizarUuid(actual.uuidCaracteristica) ===
      normalizarUuid(previo.uuidCaracteristica);
  const escritura = caracteristicas.find(
    elemento =>
      coincide(elemento, guardado.escritura) &&
      (elemento.permiteEscrituraConRespuesta ||
        elemento.permiteEscrituraSinRespuesta),
  );
  const notificacion = caracteristicas.find(
    elemento =>
      coincide(elemento, guardado.notificacion) &&
      (elemento.permiteNotificacion || elemento.permiteIndicacion),
  );
  return escritura && notificacion ? { escritura, notificacion } : null;
}
