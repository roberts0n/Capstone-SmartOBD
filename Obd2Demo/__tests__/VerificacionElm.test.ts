import {
  crearEscanerVerificado,
  identificarElm,
  obtenerCombinacionesAutomaticas,
  recuperarCanales,
} from '../src/escaneres/VerificacionElm';
import type { InformacionCaracteristicaGatt } from '../src/tipos/ble';

const escritura: InformacionCaracteristicaGatt = {
  uuidServicio: 'FFF0',
  uuidCaracteristica: 'FFF1',
  permiteLectura: false,
  permiteEscrituraConRespuesta: true,
  permiteEscrituraSinRespuesta: false,
  permiteNotificacion: false,
  permiteIndicacion: false,
};
const notificacion: InformacionCaracteristicaGatt = {
  ...escritura,
  permiteEscrituraConRespuesta: false,
  permiteNotificacion: true,
};

describe('verificación ATI', () => {
  test.each([
    ['ATI\rELM327 v1.5\r>', 'ELM327 v1.5'],
    ['ELM327 v2.1\r\r>', 'ELM327 v2.1'],
    ['STN1170 v5.7.1\r>', 'STN1170 v5.7.1'],
  ])('acepta %s', (respuesta, esperado) => {
    expect(identificarElm(respuesta)).toBe(esperado);
  });

  test.each([
    'OK\r>',
    'NO DATA\r>',
    'ELM327\r>',
    'dispositivo ELM327 encontrado\r>',
    'ELM327 v1.5',
  ])('rechaza %s', respuesta => {
    expect(identificarElm(respuesta)).toBeNull();
  });

  test('crea el registro solo con propiedades GATT válidas', () => {
    const registro = crearEscanerVerificado(
      { id: 'AA', nombre: 'OBDII', nombreLocal: null, rssi: -40 },
      escritura,
      notificacion,
      'ATI\rELM327 v1.5\r>',
    );

    expect(registro.identificacionElm).toBe('ELM327 v1.5');
    expect(registro.escritura.uuidCaracteristica).toContain('0000fff1');
  });

  test('restaura canales existentes pero rechaza un inventario cambiado', () => {
    const registro = crearEscanerVerificado(
      { id: 'AA', nombre: 'OBDII', nombreLocal: null, rssi: -40 },
      escritura,
      notificacion,
      'ELM327 v1.5\r>',
    );

    expect(
      recuperarCanales(registro, [escritura, notificacion]),
    ).not.toBeNull();
    expect(recuperarCanales(registro, [escritura])).toBeNull();
  });

  test('prioriza FFF1/FFF1 y luego FFF2/FFF1', () => {
    const fff1: InformacionCaracteristicaGatt = {
      ...escritura,
      permiteNotificacion: true,
    };
    const fff2: InformacionCaracteristicaGatt = {
      ...escritura,
      uuidCaracteristica: 'FFF2',
    };
    const servicioCambiado: InformacionCaracteristicaGatt = {
      ...notificacion,
      uuidServicio: '1801',
      uuidCaracteristica: '2A05',
    };

    expect(
      obtenerCombinacionesAutomaticas([fff2, servicioCambiado, fff1]).map(
        combinacion => combinacion.descripcion,
      ),
    ).toEqual(['FFF1 -> FFF1', 'FFF2 -> FFF1']);
  });

  test('no prueba UUID desconocidos automaticamente', () => {
    expect(
      obtenerCombinacionesAutomaticas([
        {
          ...escritura,
          uuidCaracteristica: 'ABCD',
          permiteNotificacion: true,
        },
      ]),
    ).toEqual([]);
  });
});
