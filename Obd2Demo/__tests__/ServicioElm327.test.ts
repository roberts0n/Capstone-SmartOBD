import { traducirRespuestaObd } from '../src/obd/ServicioElm327';
import {
  AcumuladorRespuestaObd,
  asciiABase64,
  base64ABytes,
} from '../src/obd/AcumuladorRespuestaObd';
import { analizarRespuestaObd } from '../src/obd/AnalisisRespuestaObd';

describe('codificación y acumulador ELM327', () => {
  test('codifica el comando ASCII con retorno de carro', () => {
    const codificado = asciiABase64('ATI\r');
    expect(String.fromCharCode(...base64ABytes(codificado))).toBe('ATI\r');
  });

  test('acumula notificaciones fragmentadas hasta el prompt', () => {
    const acumulador = new AcumuladorRespuestaObd();
    acumulador.agregarBase64(asciiABase64('41 0C '));
    expect(acumulador.estaCompleta()).toBe(false);
    acumulador.agregarBase64(asciiABase64('1A F8\r>'));
    expect(acumulador.estaCompleta()).toBe(true);
    expect(acumulador.consumir().textoAscii).toBe('41 0C 1A F8\r>');
  });
});

describe('traducción OBD2', () => {
  test('traduce RPM con y sin espacios', () => {
    expect(traducirRespuestaObd('010C', '41 0C 1A F8\r>').valor).toBe(1726);
    expect(traducirRespuestaObd('010C', '410C1AF8\r>').valor).toBe(1726);
  });

  test('traduce temperatura', () => {
    expect(traducirRespuestaObd('0105', '41057B\r>')).toEqual({
      valor: 83,
      unidad: '°C',
      error: null,
    });
  });

  test('traduce DTC sin inventar descripciones', () => {
    expect(traducirRespuestaObd('03', '43 01 33 00 00\r>').valor).toEqual([
      'P0133',
    ]);
  });

  test('no combina el final de una linea con la cabecera de la siguiente', () => {
    const respuestaRealista = '4300\r43001F\r>';

    expect(traducirRespuestaObd('03', respuestaRealista)).toEqual({
      valor: ['P001F'],
      unidad: 'DTC',
      error: null,
    });
  });

  test('elimina DTC repetidos por respuestas de varias ECU', () => {
    expect(traducirRespuestaObd('03', '03\r43001F\r43001F\r>').valor).toEqual([
      'P001F',
    ]);
  });

  test('traduce una respuesta CAN con cabecera visible', () => {
    const respuestaConCabecera = '7E8 06 43 00 1F 00 00 00 00\r>';

    expect(traducirRespuestaObd('03', respuestaConCabecera).valor).toEqual([
      'P001F',
    ]);
    expect(
      analizarRespuestaObd('03', respuestaConCabecera).lineas[0].cabecera,
    ).toBe('7E8');
  });
});

describe('diagnostico de respuesta OBD', () => {
  test('muestra por separado una linea incompleta y una valida', () => {
    const analisis = analizarRespuestaObd('03', '4300\r43001F\r>');

    expect(analisis.respuestaEscapada).toBe('4300\\r43001F\\r>');
    expect(analisis.lineas).toHaveLength(2);
    expect(analisis.lineas[0]).toMatchObject({
      bytesObd: ['43', '00'],
      codigosDtc: [],
      tipo: 'respuesta-dtc',
    });
    expect(analisis.lineas[0].advertencias).toHaveLength(1);
    expect(analisis.lineas[1]).toMatchObject({
      bytesObd: ['43', '00', '1F'],
      codigosDtc: ['P001F'],
      tipo: 'respuesta-dtc',
      advertencias: [],
    });
    expect(analisis.codigosDtc).toEqual(['P001F']);
  });
});
