/* eslint-disable no-bitwise */
import { hex } from './TiposPid';
import type { DefinicionPidMode01, ResultadoPid } from './TiposPid';

const NORMAS_OBD: Record<number, string> = {
  0: 'No disponible',
  1: 'OBD-II (CARB)',
  2: 'OBD (EPA)',
  3: 'OBD y OBD-II',
  4: 'OBD-I',
  5: 'No compatible con OBD',
  6: 'EOBD',
  7: 'EOBD y OBD-II',
  8: 'EOBD y OBD',
  9: 'EOBD, OBD y OBD-II',
  10: 'JOBD',
  11: 'JOBD y OBD-II',
  12: 'JOBD y EOBD',
  13: 'JOBD, EOBD y OBD-II',
  17: 'Diagnóstico del fabricante (EMD)',
  18: 'Diagnóstico mejorado del fabricante (EMD+)',
  19: 'HD OBD-C',
  20: 'HD OBD',
  21: 'WWH-OBD',
  23: 'HD EOBD-I',
  24: 'HD EOBD-I N',
  25: 'HD EOBD-II',
  26: 'HD EOBD-II N',
  28: 'Brasil OBD fase 1',
  29: 'Brasil OBD fase 2',
  30: 'KOBD',
  31: 'India OBD I',
  32: 'India OBD II',
  33: 'HD EOBD etapa VI',
};

const COMBUSTIBLES = [
  'No disponible',
  'Gasolina',
  'Metanol',
  'Etanol',
  'Diésel',
  'GLP',
  'Gas natural comprimido',
  'Propano',
  'Eléctrico',
  'Bicombustible usando gasolina',
  'Bicombustible usando metanol',
  'Bicombustible usando etanol',
  'Bicombustible usando GLP',
  'Bicombustible usando gas natural comprimido',
  'Bicombustible usando propano',
  'Bicombustible usando electricidad',
  'Bicombustible usando electricidad y combustión',
  'Híbrido usando gasolina',
  'Híbrido usando etanol',
  'Híbrido usando diésel',
  'Híbrido usando electricidad',
  'Híbrido usando electricidad y combustión',
  'Híbrido en regeneración',
  'Bicombustible usando diésel',
];

const ESTADOS_COMBUSTIBLE: Array<[number, string]> = [
  [1, 'Lazo abierto por temperatura insuficiente del motor'],
  [2, 'Lazo cerrado usando sensores de oxígeno'],
  [4, 'Lazo abierto por carga o desaceleración del motor'],
  [8, 'Lazo abierto por falla del sistema'],
  [16, 'Lazo cerrado con falla en al menos un sensor de oxígeno'],
];

const MONITORES_CHISPA = [
  'Catalizador',
  'Catalizador calentado',
  'Sistema evaporativo',
  'Aire secundario',
  'Refrigerante de aire acondicionado',
  'Sensor de oxígeno',
  'Calentador del sensor de oxígeno',
  'EGR o VVT',
];
const MONITORES_COMPRESION = [
  'Catalizador NMHC',
  'NOx o SCR',
  'Monitor reservado',
  'Presión de sobrealimentación',
  'Monitor reservado 2',
  'Sensor de gases de escape',
  'Filtro de partículas',
  'EGR o VVT',
];
const bit = (valor: number, indice: number) => (valor & (1 << indice)) !== 0;

function estadoMonitores(
  datos: readonly number[],
  cicloActual: boolean,
): ResultadoPid {
  const [dtc, basicos, disponibles, incompletos] = datos;
  const tipoEncendido = bit(basicos, 3) ? 'compresión' : 'chispa';
  const nombres =
    tipoEncendido === 'chispa' ? MONITORES_CHISPA : MONITORES_COMPRESION;
  const crear = (nombre: string, habilitado: boolean, incompleto: boolean) =>
    cicloActual
      ? {
          // En 41 el bit significa habilitado este ciclo, no soporte permanente.
          nombre,
          habilitadoEsteCiclo: habilitado,
          completado: habilitado ? !incompleto : null,
        }
      : {
          nombre,
          soportado: habilitado,
          completado: habilitado ? !incompleto : null,
        };
  const monitores = [
    ...[
      'Fallas de encendido',
      'Sistema de combustible',
      'Componentes integrales',
    ].map((nombre, indice) =>
      crear(nombre, bit(basicos, indice), bit(basicos, indice + 4)),
    ),
    ...nombres.map((nombre, indice) =>
      crear(nombre, bit(disponibles, indice), bit(incompletos, indice)),
    ),
  ];
  return {
    valor: {
      ...(cicloActual
        ? { alcance: 'Ciclo de conducción actual' }
        : { milEncendida: bit(dtc, 7), cantidadDtc: dtc & 127 }),
      tipoEncendido,
      monitores,
    },
    unidad: null,
  };
}

function presenciaOxigeno(
  datos: readonly number[],
  porBanco: number,
): ResultadoPid {
  const sensoresPresentes = [];
  for (let indice = 0; indice < 8; indice += 1) {
    if (bit(datos[0], indice)) {
      sensoresPresentes.push(
        `Banco ${Math.floor(indice / porBanco) + 1} Sensor ${
          (indice % porBanco) + 1
        }`,
      );
    }
  }
  return { valor: { sensoresPresentes }, unidad: null };
}

const estado = (
  pid: number,
  nombre: string,
  bytesEsperados: number,
  interpretar: DefinicionPidMode01['interpretar'],
): DefinicionPidMode01 => ({
  comando: `01${hex(pid)}`,
  nombre,
  bytesEsperados,
  categoria: 'Estados y configuracion',
  interpretar,
});

export const ESTADOS_MODE_01: readonly DefinicionPidMode01[] = [
  estado(0x01, 'Estado del sistema desde borrado de DTC', 4, datos =>
    estadoMonitores(datos, false),
  ),
  estado(0x02, 'DTC que originó el cuadro congelado', 2, datos => {
    // Este PID contiene un codigo, no es una consulta al servicio 03.
    const codigo =
      datos[0] === 0 && datos[1] === 0
        ? null
        : `${['P', 'C', 'B', 'U'][datos[0] >> 6]}${(datos[0] >> 4) & 3}${(
            datos[0] & 15
          )
            .toString(16)
            .toUpperCase()}${hex(datos[1])}`;
    return {
      valor: { codigoDtc: codigo, cuadroCongeladoDisponible: codigo !== null },
      unidad: null,
    };
  }),
  estado(0x03, 'Estado del sistema de combustible', 2, datos => ({
    valor: {
      sistema1: ESTADOS_COMBUSTIBLE.filter(
        ([mascara]) => (datos[0] & mascara) !== 0,
      ).map(([, nombre]) => nombre),
      sistema2: ESTADOS_COMBUSTIBLE.filter(
        ([mascara]) => (datos[1] & mascara) !== 0,
      ).map(([, nombre]) => nombre),
      ...(datos.some(valor => valor > 31)
        ? {
            advertencia: 'Bits de estado reservados presentes',
            bytes: [...datos],
          }
        : {}),
    },
    unidad: null,
  })),
  estado(0x12, 'Estado del aire secundario solicitado', 1, datos => ({
    valor: {
      codigo: datos[0],
      descripcion:
        (
          {
            1: 'Aguas arriba del catalizador',
            2: 'Aguas abajo del catalizador',
            4: 'Aire exterior o desactivado',
            8: 'Bomba activada para diagnóstico',
          } as Record<number, string>
        )[datos[0]] ?? 'Estado reservado o no reconocido',
    },
    unidad: null,
  })),
  estado(0x13, 'Sensores de oxígeno presentes (2 bancos)', 1, datos =>
    presenciaOxigeno(datos, 4),
  ),
  estado(0x1c, 'Norma OBD compatible', 1, datos => ({
    valor: NORMAS_OBD[datos[0]] ?? `Código de cumplimiento OBD ${datos[0]}`,
    unidad: null,
  })),
  estado(0x1d, 'Sensores de oxígeno presentes (4 bancos)', 1, datos =>
    presenciaOxigeno(datos, 2),
  ),
  estado(0x1e, 'Estado de entrada auxiliar PTO', 1, datos => ({
    valor: {
      tomaDeFuerzaActiva: bit(datos[0], 0),
      bitsReservados: datos[0] & 254,
    },
    unidad: null,
  })),
  estado(0x41, 'Estado de monitores en este ciclo', 4, datos =>
    estadoMonitores(datos, true),
  ),
  estado(0x4f, 'Configuración de escalas OBD', 4, datos => ({
    valor: {
      // Cero significa escala estandar; no significa maximo fisico igual a cero.
      maximoLambda: datos[0] || null,
      maximoVoltajeOxigeno: datos[1] || null,
      unidadVoltaje: 'V',
      maximoCorrienteOxigeno: datos[2] || null,
      unidadCorriente: 'mA',
      maximoPresionAdmision: datos[3] ? datos[3] * 10 : null,
      unidadPresion: 'kPa',
      significadoNull: 'Usar la escala estándar de ese campo',
    },
    unidad: null,
  })),
  estado(0x50, 'Configuración de escala MAF', 4, datos => ({
    valor: {
      maximoCaudal: datos[0] ? datos[0] * 10 : null,
      unidadCaudal: 'g/s',
      significadoNull: 'Usar la escala estándar MAF',
      bytesReservados: datos.slice(1),
    },
    unidad: null,
  })),
  estado(0x51, 'Combustible utilizado', 1, datos => ({
    valor: {
      codigo: datos[0],
      descripcion:
        COMBUSTIBLES[datos[0]] ?? 'Combustible reservado o no reconocido',
      disponible: datos[0] !== 0 && datos[0] < COMBUSTIBLES.length,
    },
    unidad: null,
  })),
  estado(0x5f, 'Requisitos de emisiones', 1, datos => ({
    valor: {
      codigo: datos[0],
      descripcion:
        (
          { 14: 'EURO IV B1', 15: 'EURO V B2', 16: 'EURO EEV C' } as Record<
            number,
            string
          >
        )[datos[0]] ??
        'Código no definido en la referencia SAE J1979-DA 2011 utilizada',
      referencia: 'SAE J1979-DA 2011, tabla B76',
    },
    unidad: null,
  })),
];
