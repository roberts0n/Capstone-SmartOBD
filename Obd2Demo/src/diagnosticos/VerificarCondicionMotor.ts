import { traducirPidMode01 } from '../obd/CatalogoPidsMode01';
import type { RespuestaElm } from '../tipos/ble';

export const RPM_MINIMAS_MOTOR_EN_MARCHA = 300;
const CANTIDAD_LECTURAS = 2;

export type EstadoVerificacionMotor =
  | 'en-marcha'
  | 'detenido'
  | 'no-verificable';

export interface VerificacionMotor {
  estado: EstadoVerificacionMotor;
  lecturasRpm: number[];
  mensaje: string;
}

export async function verificarMotorEnMarcha(
  enviar: (comando: string) => Promise<RespuestaElm>,
  cancelado: () => boolean = () => false,
): Promise<VerificacionMotor> {
  const lecturasRpm: number[] = [];

  for (let indice = 0; indice < CANTIDAD_LECTURAS; indice += 1) {
    if (cancelado()) {
      throw new Error('La verificacion del motor fue cancelada.');
    }

    try {
      const respuesta = await enviar('010C');
      const traduccion = traducirPidMode01('010C', respuesta.textoAscii);
      if (
        !traduccion ||
        traduccion.error ||
        typeof traduccion.valor !== 'number'
      ) {
        return {
          estado: 'no-verificable',
          lecturasRpm,
          mensaje:
            traduccion?.error ?? 'La ECU no entrego una lectura RPM valida.',
        };
      }
      lecturasRpm.push(traduccion.valor);
    } catch (capturado) {
      return {
        estado: 'no-verificable',
        lecturasRpm,
        mensaje: mensajeError(capturado),
      };
    }
  }

  const enMarcha = lecturasRpm.every(
    rpm => rpm >= RPM_MINIMAS_MOTOR_EN_MARCHA,
  );
  return enMarcha
    ? {
        estado: 'en-marcha',
        lecturasRpm,
        mensaje: `Motor verificado con ${lecturasRpm.join(' y ')} rpm.`,
      }
    : {
        estado: 'detenido',
        lecturasRpm,
        mensaje: `El motor no se mantiene sobre ${RPM_MINIMAS_MOTOR_EN_MARCHA} rpm.`,
      };
}

function mensajeError(capturado: unknown): string {
  return capturado instanceof Error ? capturado.message : String(capturado);
}
