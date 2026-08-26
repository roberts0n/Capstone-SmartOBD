import type { MetricasFlujoObd, MetricasRecepcionElm } from '../tipos/ble';

export interface MarcasProcesamientoObd {
  inicioTraduccionMs: number;
  traduccionCompletaMs: number;
  resultadoConstruidoMs: number;
  jsonCompletoMs: number;
}

/* convierte marcas absolutas del reloj en duraciones faciles de comparar */
export function calcularMetricasFlujoObd(
  comando: string,
  recepcion: MetricasRecepcionElm,
  procesamiento: MarcasProcesamientoObd,
): MetricasFlujoObd {
  const respuestaCompletaMs =
    recepcion.respuestaCompletaMs ?? procesamiento.inicioTraduccionMs;

  return {
    comando: comando.trim().toUpperCase(),
    escrituraBleMs: diferenciaOpcional(
      recepcion.escrituraBleCompletaMs,
      recepcion.inicioComandoMs,
    ),
    latenciaPrimerFragmentoMs: diferenciaOpcional(
      recepcion.primerFragmentoMs,
      recepcion.inicioComandoMs,
    ),
    recepcionFragmentosMs: diferenciaOpcional(
      respuestaCompletaMs,
      recepcion.primerFragmentoMs,
    ),
    respuestaCompletaMs: diferencia(
      respuestaCompletaMs,
      recepcion.inicioComandoMs,
    ),
    traduccionObdMs: diferencia(
      procesamiento.traduccionCompletaMs,
      procesamiento.inicioTraduccionMs,
    ),
    construccionResultadoMs: diferencia(
      procesamiento.resultadoConstruidoMs,
      procesamiento.traduccionCompletaMs,
    ),
    serializacionJsonMs: diferencia(
      procesamiento.jsonCompletoMs,
      procesamiento.resultadoConstruidoMs,
    ),
    desdePrimerFragmentoHastaJsonMs: diferenciaOpcional(
      procesamiento.jsonCompletoMs,
      recepcion.primerFragmentoMs,
    ),
    totalHastaJsonMs: diferencia(
      procesamiento.jsonCompletoMs,
      recepcion.inicioComandoMs,
    ),
    cantidadFragmentos: recepcion.cantidadFragmentos,
    cantidadBytes: recepcion.cantidadBytes,
  };
}

function diferencia(finMs: number, inicioMs: number): number {
  return Math.max(0, finMs - inicioMs);
}

function diferenciaOpcional(
  finMs: number | null,
  inicioMs: number | null,
): number | null {
  return finMs === null || inicioMs === null
    ? null
    : diferencia(finMs, inicioMs);
}
