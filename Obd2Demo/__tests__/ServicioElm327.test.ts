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

  test.each(['03', '07', '0A'])(
    'deriva %s al lector DTC que conoce protocolo y cabeceras',
    comando => {
      expect(traducirRespuestaObd(comando, '43 01 01 04\r>')).toMatchObject({
        valor: null,
        unidad: null,
        error: expect.stringContaining('Leer todos los DTC'),
      });
    },
  );

  test('el analizador crudo aun muestra cabeceras sin diagnosticar', () => {
    const respuestaConCabecera = '7E8 06 43 00 1F 00 00 00 00\r>';
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
