import { ServicioElm327, ErrorCapturaElm } from '../src/obd/ServicioElm327';
import { asciiABase64 } from '../src/obd/AcumuladorRespuestaObd';
import type { ServicioBle } from '../src/ble/ServicioBle';

function preparar() {
  let recibir: (
    error: null | { message: string },
    valor: string | null,
  ) => void = () => undefined;
  const escribir = jest.fn().mockResolvedValue(undefined);
  const ble = {
    escribir,
    monitorear: jest.fn((_id, _canal, fn) => {
      recibir = fn;
      return { remove: jest.fn() };
    }),
  };
  const servicio = new ServicioElm327(ble as unknown as ServicioBle);
  const canal = {
    uuidServicio: 'fff0',
    uuidCaracteristica: 'fff1',
    permiteLectura: false,
    permiteEscrituraConRespuesta: true,
    permiteEscrituraSinRespuesta: true,
    permiteNotificacion: true,
    permiteIndicacion: false,
  };
  servicio.suscribirse('test', canal, {
    alRecibirFragmento: jest.fn(),
    alOcurrirError: jest.fn(),
  });
  return {
    servicio,
    canal,
    escribir,
    rx: (texto: string) => recibir(null, asciiABase64(texto)),
    errorRx: () => recibir({ message: 'BLE cortado' }, null),
  };
}

describe('evidencia de recepcion ELM', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  test('guarda fragmentos exactos y respuesta completa', async () => {
    const p = preparar();
    const resultado = p.servicio.enviarComando('test', p.canal, '07');
    p.rx('47 01 ');
    p.rx('01 04\r>');
    const datos = await resultado;
    expect(datos.textoAscii).toBe('47 01 01 04\r>');
    expect(datos.fragmentos?.map(f => f.textoAscii)).toEqual([
      '47 01 ',
      '01 04\r>',
    ]);
    expect(datos.fragmentos?.[0].base64).toBe(asciiABase64('47 01 '));
  });
  test('timeout conserva bytes parciales y bloquea hasta el prompt tardio', async () => {
    jest.useFakeTimers();
    const p = preparar();
    const promesa = p.servicio.enviarComando('test', p.canal, '07', 100);
    // Se adjunta el rechazo ANTES de disparar el timer y se espera mas abajo.
    // eslint-disable-next-line jest/valid-expect
    const rechazo = expect(promesa).rejects.toMatchObject({
      captura: { textoAscii: '47 01' },
    });
    p.rx('47 01');
    await jest.advanceTimersByTimeAsync(100);
    await rechazo;
    expect(p.servicio.estaSincronizado()).toBe(false);
    await expect(
      p.servicio.enviarComando('test', p.canal, '03'),
    ).rejects.toThrow('prompt');
    p.rx(' 01 04\r>');
    expect(p.servicio.estaSincronizado()).toBe(true);
    const siguiente = p.servicio.enviarComando('test', p.canal, '03');
    p.rx('43 00\r>');
    expect((await siguiente).textoAscii).toBe('43 00\r>');
  });
  test('cancelacion no borra la captura antes de construir el error', async () => {
    const p = preparar();
    const promesa = p.servicio.enviarComando('test', p.canal, '03');
    // eslint-disable-next-line jest/valid-expect
    const rechazo = expect(promesa).rejects.toMatchObject({
      captura: { textoAscii: '43 ' },
    });
    p.rx('43 ');
    p.servicio.cancelarSuscripcion();
    await rechazo;
  });
  test('error BLE conserva evidencia y no permite continuar sin sincronizacion', async () => {
    const p = preparar();
    const promesa = p.servicio.enviarComando('test', p.canal, '03');
    // eslint-disable-next-line jest/valid-expect
    const rechazo = expect(promesa).rejects.toBeInstanceOf(ErrorCapturaElm);
    p.rx('43');
    p.errorRx();
    await rechazo;
    expect(p.servicio.estaSincronizado()).toBe(false);
  });
  test('escritura fallida rechaza una sola promesa con captura', async () => {
    const p = preparar();
    p.escribir.mockRejectedValueOnce(new Error('TX fallido'));
    await expect(
      p.servicio.enviarComando('test', p.canal, '03'),
    ).rejects.toMatchObject({ name: 'ErrorCapturaElm', message: 'TX fallido' });
  });
});
