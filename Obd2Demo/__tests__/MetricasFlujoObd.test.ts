import { calcularMetricasFlujoObd } from '../src/obd/MetricasFlujoObd';

describe('metricas del flujo OBD', () => {
  test('calcula las duraciones de comunicacion y procesamiento', () => {
    const metricas = calcularMetricasFlujoObd(
      '010c',
      {
        inicioComandoMs: 100,
        escrituraBleCompletaMs: 102,
        primerFragmentoMs: 140,
        respuestaCompletaMs: 155,
        cantidadFragmentos: 2,
        cantidadBytes: 12,
      },
      {
        inicioTraduccionMs: 155.2,
        traduccionCompletaMs: 155.4,
        resultadoConstruidoMs: 155.5,
        jsonCompletoMs: 155.8,
      },
    );

    expect(metricas.comando).toBe('010C');
    expect(metricas.escrituraBleMs).toBeCloseTo(2);
    expect(metricas.latenciaPrimerFragmentoMs).toBeCloseTo(40);
    expect(metricas.recepcionFragmentosMs).toBeCloseTo(15);
    expect(metricas.respuestaCompletaMs).toBeCloseTo(55);
    expect(metricas.traduccionObdMs).toBeCloseTo(0.2);
    expect(metricas.construccionResultadoMs).toBeCloseTo(0.1);
    expect(metricas.serializacionJsonMs).toBeCloseTo(0.3);
    expect(metricas.desdePrimerFragmentoHastaJsonMs).toBeCloseTo(15.8);
    expect(metricas.totalHastaJsonMs).toBeCloseTo(55.8);
    expect(metricas.cantidadFragmentos).toBe(2);
    expect(metricas.cantidadBytes).toBe(12);
  });
});
