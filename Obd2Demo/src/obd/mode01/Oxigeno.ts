import { ajuste, entero16, hex, redondear } from './TiposPid';
import type { ContextoFormulaPid, DefinicionPidMode01 } from './TiposPid';

function nombreSensor(indice: number, contexto: ContextoFormulaPid) {
  const porBanco = contexto.cuatroBancos ? 2 : 4;
  return `Banco ${Math.floor(indice / porBanco) + 1} Sensor ${
    (indice % porBanco) + 1
  }`;
}

// La misma estructura se repite para ocho posiciones; cambia el PID, no la formula.
export const OXIGENO_MODE_01: readonly DefinicionPidMode01[] = [
  ...Array.from(
    { length: 8 },
    (_, indice): DefinicionPidMode01 => ({
      comando: `01${hex(0x14 + indice)}`,
      nombre: `Sensor de oxígeno ${indice + 1}: voltaje y ajuste`,
      categoria: 'Oxigeno y mezcla',
      bytesEsperados: 2,
      interpretar: (datos, contexto = {}) => ({
        valor: {
          sensor: nombreSensor(indice, contexto),
          voltaje: redondear(datos[0] / 200),
          unidadVoltaje: 'V',
          // FF tiene un significado especial aqui, no en todos los PID porcentuales.
          ajusteCombustible:
            datos[1] === 255 ? null : redondear(ajuste(datos[1])),
          unidadAjuste: '%',
        },
        unidad: null,
      }),
    }),
  ),
  ...[0x24, 0x34].flatMap(base =>
    Array.from(
      { length: 8 },
      (_, indice): DefinicionPidMode01 => ({
        comando: `01${hex(base + indice)}`,
        nombre: `Sensor de oxígeno ${indice + 1}: lambda y ${
          base === 0x24 ? 'voltaje' : 'corriente'
        }`,
        categoria: 'Oxigeno y mezcla',
        bytesEsperados: 4,
        interpretar: (datos, contexto = {}) => ({
          valor: {
            sensor: nombreSensor(indice, contexto),
            lambda: redondear(
              entero16(datos) *
                (contexto.escalas?.[0]
                  ? contexto.escalas[0] / 65535
                  : 1 / 32768),
              4,
            ),
            ...(base === 0x24
              ? {
                  voltaje: redondear(
                    entero16(datos, 2) *
                      (contexto.escalas?.[1]
                        ? contexto.escalas[1] / 65535
                        : 1 / 8192),
                    4,
                  ),
                  unidadVoltaje: 'V',
                }
              : {
                  corriente: redondear(
                    (entero16(datos, 2) - 32768) *
                      (contexto.escalas?.[2]
                        ? contexto.escalas[2] / 32768
                        : 1 / 256),
                    4,
                  ),
                  unidadCorriente: 'mA',
                }),
          },
          unidad: null,
        }),
      }),
    ),
  ),
  ...[0x06, 0x07, 0x08, 0x09, 0x55, 0x56, 0x57, 0x58].map(
    (pid, indice): DefinicionPidMode01 => {
      const banco = indice % 4 < 2 ? 1 : 2;
      return {
        comando: `01${hex(pid)}`,
        nombre: `Ajuste ${
          indice % 2 === 0 ? 'corto' : 'largo'
        } de combustible ${indice >= 4 ? 'secundario ' : ''}banco ${banco} (y ${
          banco + 2
        } si existe)`,
        categoria: 'Oxigeno y mezcla',
        bytesEsperados: 1,
        bytesMaximos: 2,
        interpretar: datos =>
          datos.length === 1
            ? { valor: redondear(ajuste(datos[0])), unidad: '%' }
            : {
                valor: {
                  [`banco${banco}`]: redondear(ajuste(datos[0])),
                  [`banco${banco + 2}`]: redondear(ajuste(datos[1])),
                  unidad: '%',
                },
                unidad: null,
              },
      };
    },
  ),
];
