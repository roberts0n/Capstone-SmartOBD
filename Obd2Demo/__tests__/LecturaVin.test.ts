import {
  comprobarDisponibilidadVin,
  decodificarVin,
} from '../src/obd/LecturaVin';

const VIN_EJEMPLO = '1D4GP00R55B123456';

describe('disponibilidad VIN en Mode 09', () => {
  test('detecta el bit correspondiente a PID 02', () => {
    expect(comprobarDisponibilidadVin('0900\r49 00 40 00 00 00\r>')).toEqual({
      disponible: true,
      mascaraHexadecimal: '40 00 00 00',
    });
  });

  test('distingue una respuesta valida que no anuncia PID 02', () => {
    expect(comprobarDisponibilidadVin('49 00 80 00 00 00\r>')).toEqual({
      disponible: false,
      mascaraHexadecimal: '80 00 00 00',
    });
  });

  test('informa NO DATA sin confundirlo con falta de bytes', () => {
    expect(() => comprobarDisponibilidadVin('NO DATA\r>')).toThrow(
      'La consulta VIN devolvio NO DATA',
    );
  });
});

describe('decodificacion VIN', () => {
  test('reconstruye la respuesta CAN formateada por ELM327', () => {
    const respuesta = [
      '0902',
      '014',
      '0: 49 02 01 31 44 34',
      '1: 47 50 30 30 52 35 35',
      '2: 42 31 32 33 34 35 36',
      '>',
    ].join('\r');

    expect(decodificarVin(respuesta)).toBe(VIN_EJEMPLO);
  });

  test('reconstruye registros de protocolos anteriores a CAN', () => {
    const respuesta = [
      '49 02 01 00 00 00 31',
      '49 02 02 44 34 47 50',
      '49 02 03 30 30 52 35',
      '49 02 04 35 42 31 32',
      '49 02 05 33 34 35 36',
      '>',
    ].join('\r');

    expect(decodificarVin(respuesta)).toBe(VIN_EJEMPLO);
  });

  test('reconstruye tramas CAN con cabeceras visibles', () => {
    const respuesta = [
      '7E8 10 14 49 02 01 31 44 34',
      '7E8 21 47 50 30 30 52 35 35',
      '7E8 22 42 31 32 33 34 35 36',
      '>',
    ].join('\r');

    expect(decodificarVin(respuesta)).toBe(VIN_EJEMPLO);
  });

  test('acepta respuestas duplicadas si contienen el mismo VIN', () => {
    const grupo = [
      '014',
      '0: 49 02 01 31 44 34',
      '1: 47 50 30 30 52 35 35',
      '2: 42 31 32 33 34 35 36',
    ];

    expect(decodificarVin([...grupo, ...grupo, '>'].join('\r'))).toBe(
      VIN_EJEMPLO,
    );
  });

  test('rechaza respuestas incompletas o caracteres prohibidos', () => {
    expect(() => decodificarVin('49 02 01 31 32 33\r>')).toThrow(
      'No se encontro 49 02 seguido de un VIN valido',
    );
    expect(() =>
      decodificarVin(
        '49 02 01 31 44 34 47 50 30 30 52 35 35 42 31 32 33 34 49 36\r>',
      ),
    ).toThrow('VIN valido');
  });
});
