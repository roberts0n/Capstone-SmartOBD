import { base64ABytes } from '../obd/AcumuladorRespuestaObd';
import type { InformacionDispositivoBle } from '../tipos/ble';
import type { CandidatoEscaner, EscanerGuardado } from '../tipos/escaner';

export interface PerfilEscaner {
  id: string;
  nombre: string;
  patronesNombre: readonly RegExp[];
  serviciosAnunciados: readonly string[];
  // Firmas del anuncio completo en hexadecimal, no simples codigos de empresa.
  prefijosFabricanteHex: readonly string[];
}

/** Un indicio del anuncio nunca prueba compatibilidad ni autentica al equipo. */
export const PERFILES_ESCANER: readonly PerfilEscaner[] = [
  {
    id: 'nombre-obd-elm',
    nombre: 'Nombre relacionado con OBD / ELM',
    patronesNombre: [/\bOBD(?:[\s_-]*(?:II|2))?\b/i, /\bELM\s*327\b/i],
    serviciosAnunciados: [],
    prefijosFabricanteHex: [],
  },
  {
    id: 'nombre-familias-obd',
    nombre: 'Nombre de una familia de adaptadores OBD',
    patronesNombre: [/\b(?:OBDLINK|VGATE|VLINK|VEEPEAK)[A-Z0-9_-]*\b/i],
    serviciosAnunciados: [],
    prefijosFabricanteHex: [],
  },
  {
    id: 'transporte-serial-generico',
    nombre: 'Servicio serial genérico (también usado fuera de OBD)',
    patronesNombre: [],
    serviciosAnunciados: [
      'FFF0',
      'FFE0',
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    ],
    // No inventar firmas de fabricante: agregarlas solo tras documentar capturas.
    prefijosFabricanteHex: [],
  },
];

export function normalizarUuid(uuid: string): string {
  const valor = uuid.trim().toLowerCase();
  if (/^[0-9a-f]{4}$/.test(valor)) {
    return `0000${valor}-0000-1000-8000-00805f9b34fb`;
  }
  if (/^[0-9a-f]{8}$/.test(valor)) {
    return `${valor}-0000-1000-8000-00805f9b34fb`;
  }
  return valor;
}

export function nombreDispositivo(dispositivo: {
  nombre: string | null;
  nombreLocal: string | null;
}): string {
  return (
    dispositivo.nombre?.trim() ||
    dispositivo.nombreLocal?.trim() ||
    'Dispositivo sin nombre'
  );
}

/** Conserva los datos que pueden faltar en anuncios BLE sucesivos. */
export function combinarAnuncios(
  anterior: InformacionDispositivoBle,
  nuevo: InformacionDispositivoBle,
): InformacionDispositivoBle {
  return {
    ...nuevo,
    nombre: nuevo.nombre?.trim() || anterior.nombre,
    nombreLocal: nuevo.nombreLocal?.trim() || anterior.nombreLocal,
    rssi: nuevo.rssi ?? anterior.rssi,
    serviciosAnunciados: [
      ...new Set(
        [
          ...(anterior.serviciosAnunciados ?? []),
          ...(nuevo.serviciosAnunciados ?? []),
        ].map(normalizarUuid),
      ),
    ],
    datosFabricante: nuevo.datosFabricante || anterior.datosFabricante,
  };
}

export function clasificarDispositivo(
  dispositivo: InformacionDispositivoBle,
  guardados: readonly EscanerGuardado[] = [],
  perfiles: readonly PerfilEscaner[] = PERFILES_ESCANER,
): CandidatoEscaner {
  if (guardados.some(guardado => guardado.id === dispositivo.id)) {
    return {
      dispositivo,
      nivel: 'guardado',
      motivos: [
        'Verificado anteriormente; no confirma el estado actual del vehículo.',
      ],
      perfiles: [],
    };
  }
  const nombres = [dispositivo.nombre, dispositivo.nombreLocal].filter(
    Boolean,
  ) as string[];
  const servicios = new Set(
    (dispositivo.serviciosAnunciados ?? []).map(normalizarUuid),
  );
  let fabricante = '';
  try {
    fabricante = dispositivo.datosFabricante
      ? base64ABytes(dispositivo.datosFabricante)
          .map(byte => byte.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()
      : '';
  } catch {
    // Un anuncio incompleto no debe interrumpir la busqueda.
  }
  let probable = false;
  const motivos: string[] = [];
  const coincidencias: string[] = [];
  for (const perfil of perfiles) {
    const nombreCoincide = perfil.patronesNombre.some(patron =>
      nombres.some(nombre =>
        new RegExp(patron.source, patron.flags.replace(/[gy]/g, '')).test(
          nombre,
        ),
      ),
    );
    const servicioCoincide = perfil.serviciosAnunciados.some(uuid =>
      servicios.has(normalizarUuid(uuid)),
    );
    const fabricanteCoincide = perfil.prefijosFabricanteHex.some(
      prefijo =>
        /^[0-9A-F]{8,}$/i.test(prefijo) &&
        prefijo.length % 2 === 0 &&
        fabricante.startsWith(prefijo.toUpperCase()),
    );
    if (nombreCoincide || servicioCoincide || fabricanteCoincide) {
      coincidencias.push(perfil.id);
      motivos.push(
        `${perfil.nombre}: ${[
          nombreCoincide && 'coincide el nombre',
          servicioCoincide && 'coincide un servicio anunciado',
          fabricanteCoincide && 'coincide una firma del anuncio',
        ]
          .filter(Boolean)
          .join(', ')}.`,
      );
      probable ||= nombreCoincide || fabricanteCoincide;
    }
  }
  return {
    dispositivo,
    nivel: probable
      ? 'probable'
      : coincidencias.length > 0
      ? 'posible'
      : 'desconocido',
    motivos:
      motivos.length > 0
        ? motivos
        : ['Sin indicios conocidos. No significa que sea incompatible.'],
    perfiles: coincidencias,
  };
}

export function ordenarCandidatos(
  candidatos: CandidatoEscaner[],
): CandidatoEscaner[] {
  const prioridad = { guardado: 0, probable: 1, posible: 2, desconocido: 3 };
  return [...candidatos].sort(
    (a, b) =>
      prioridad[a.nivel] - prioridad[b.nivel] ||
      (b.dispositivo.rssi ?? -999) - (a.dispositivo.rssi ?? -999) ||
      a.dispositivo.id.localeCompare(b.dispositivo.id),
  );
}
