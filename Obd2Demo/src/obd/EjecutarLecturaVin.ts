import type { RespuestaElm } from '../tipos/ble';
import { comprobarDisponibilidadVin, decodificarVin } from './LecturaVin';

export interface ResultadoLecturaVin {
  vin: string | null;
  disponible: boolean | null;
  advertencia: string | null;
}

export async function ejecutarLecturaVin(
  enviar: (comando: string) => Promise<RespuestaElm>,
): Promise<ResultadoLecturaVin> {
  try {
    const respuesta0900 = await enviar('0900');
    const disponibilidad = comprobarDisponibilidadVin(
      respuesta0900.textoAscii,
    );
    if (!disponibilidad.disponible) {
      return {
        vin: null,
        disponible: false,
        advertencia: 'La ECU no declara compatibilidad con la lectura VIN.',
      };
    }

    const respuesta0902 = await enviar('0902');
    return {
      vin: decodificarVin(respuesta0902.textoAscii),
      disponible: true,
      advertencia: null,
    };
  } catch (capturado) {
    return {
      vin: null,
      disponible: null,
      advertencia: mensajeError(capturado),
    };
  }
}

function mensajeError(capturado: unknown): string {
  return capturado instanceof Error ? capturado.message : String(capturado);
}
