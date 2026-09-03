import {
  CATALOGO_PIDS_MODE_01,
  obtenerDefinicionPidMode01,
} from '../src/obd/CatalogoPidsMode01';
import { traducirRespuestaObd } from '../src/obd/ServicioElm327';

describe('catalogo de PID Mode 01', () => {
  test('contiene los 23 PID declarados por el vehiculo de prueba', () => {
    expect(CATALOGO_PIDS_MODE_01.map(definicion => definicion.comando)).toEqual(
      expect.arrayContaining([
        '0101',
        '0103',
        '0104',
        '0105',
        '0106',
        '0107',
        '010B',
        '010C',
        '010D',
        '010E',
        '010F',
        '0111',
        '0113',
        '0114',
        '0115',
        '011C',
        '0121',
        '012E',
        '0130',
        '0131',
        '0145',
        '0147',
        '014C',
      ]),
    );
  });

  test.each([
    ['0104', '41 04 80\r>', 50.2, '%'],
    ['0105', '41 05 7B\r>', 83, '°C'],
    ['0106', '41 06 90\r>', 12.5, '%'],
    ['0107', '41 07 70\r>', -12.5, '%'],
    ['010B', '41 0B 64\r>', 100, 'kPa'],
    ['010C', '41 0C 1A F8\r>', 1726, 'rpm'],
    ['010D', '41 0D 50\r>', 80, 'km/h'],
    ['010E', '41 0E 90\r>', 8, '°'],
    ['010F', '41 0F 50\r>', 40, '°C'],
    ['0111', '41 11 80\r>', 50.2, '%'],
    ['0121', '41 21 01 F4\r>', 500, 'km'],
    ['012E', '41 2E 40\r>', 25.1, '%'],
    ['0130', '41 30 05\r>', 5, 'ciclos'],
    ['0131', '41 31 03 E8\r>', 1000, 'km'],
    ['0145', '41 45 80\r>', 50.2, '%'],
    ['0147', '41 47 80\r>', 50.2, '%'],
    ['014C', '41 4C 80\r>', 50.2, '%'],
  ])(
    'traduce %s con su formula y unidad',
    (comando, respuesta, valor, unidad) => {
      expect(traducirRespuestaObd(comando, respuesta)).toEqual({
        valor,
        unidad,
        error: null,
      });
    },
  );

  test('interpreta MIL, DTC y monitores de preparacion', () => {
    const traduccion = traducirRespuestaObd('0101', '41 01 82 07 00 00\r>');

    expect(traduccion.valor).toEqual(
      expect.objectContaining({
        milEncendida: true,
        cantidadDtc: 2,
        tipoEncendido: 'chispa',
        monitores: expect.arrayContaining([
          {
            nombre: 'Fallas de encendido',
            soportado: true,
            completado: true,
          },
          {
            nombre: 'Sistema de combustible',
            soportado: true,
            completado: true,
          },
          {
            nombre: 'Componentes integrales',
            soportado: true,
            completado: true,
          },
        ]),
      }),
    );
  });

  test('interpreta los dos estados del sistema de combustible', () => {
    expect(traducirRespuestaObd('0103', '41 03 02 00\r>').valor).toEqual({
      sistema1: ['Lazo cerrado usando sensores de oxígeno'],
      sistema2: [],
    });
  });

  test('enumera los sensores de oxigeno informados', () => {
    expect(traducirRespuestaObd('0113', '41 13 03\r>').valor).toEqual({
      sensoresPresentes: ['Banco 1 Sensor 1', 'Banco 1 Sensor 2'],
    });
  });

  test('interpreta voltaje y ajuste de un sensor de oxigeno', () => {
    expect(traducirRespuestaObd('0114', '41 14 80 90\r>').valor).toEqual({
      sensor: 'Banco 1 Sensor 1',
      voltaje: 0.64,
      unidadVoltaje: 'V',
      ajusteCombustible: 12.5,
      unidadAjuste: '%',
    });
    expect(traducirRespuestaObd('0115', '41 15 80 FF\r>').valor).toMatchObject({
      ajusteCombustible: null,
    });
  });

  test('interpreta la norma OBD y tolera una cabecera CAN visible', () => {
    expect(traducirRespuestaObd('011C', '7E8 03 41 1C 06\r>')).toEqual({
      valor: 'EOBD',
      unidad: null,
      error: null,
    });
  });

  test('informa un error si un PID conocido no trae suficientes bytes', () => {
    const traduccion = traducirRespuestaObd('010C', '41 0C 1A\r>');

    expect(traduccion.valor).toBeNull();
    expect(traduccion.error).toContain('41 0C');
  });

  test('permite consultar los nombres que usa la interfaz', () => {
    expect(obtenerDefinicionPidMode01(' 010d ')?.nombre).toBe(
      'Velocidad del vehículo',
    );
    expect(obtenerDefinicionPidMode01('0199')).toBeNull();
  });
});
