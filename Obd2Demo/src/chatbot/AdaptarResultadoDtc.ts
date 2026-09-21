import type { ResultadoJsonDtc } from '../obd/dtc/PruebaDtc';
import type { DtcEntradaChatbot, EstadoDtcChatbot } from './TiposChatbot';

const PATRON_DTC = /^[PCBU][0-3][0-9A-F]{3}$/;

export function adaptarResultadoDtc(
  casoId: string,
  resultado: ResultadoJsonDtc,
): DtcEntradaChatbot[] {
  const categorias: Array<{
    estado: EstadoDtcChatbot;
    codigos: readonly string[];
  }> = [
    {
      estado: 'confirmado',
      codigos: resultado.datoTraducido.confirmados.codigos,
    },
    {
      estado: 'pendiente',
      codigos: resultado.datoTraducido.pendientes.codigos,
    },
    {
      estado: 'permanente',
      codigos: resultado.datoTraducido.permanentes.codigos,
    },
  ];

  const vistos = new Set<string>();
  const adaptados: DtcEntradaChatbot[] = [];

  for (const categoria of categorias) {
    for (const codigoOriginal of categoria.codigos) {
      const codigo = codigoOriginal.trim().toUpperCase();
      const clave = `${codigo}:${categoria.estado}`;
      if (!PATRON_DTC.test(codigo) || vistos.has(clave)) {
        continue;
      }

      vistos.add(clave);
      adaptados.push({
        casoId,
        codigo,
        estado: categoria.estado,
        fecha: resultado.fecha,
        valido: true,
      });
    }
  }

  return adaptados;
}
