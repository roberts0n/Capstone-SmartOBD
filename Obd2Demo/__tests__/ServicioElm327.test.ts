import { traducirRespuestaObd } from '../src/obd/ServicioElm327';
import {
  AcumuladorRespuestaObd,
  asciiABase64,
  base64ABytes,
} from '../src/obd/AcumuladorRespuestaObd';

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
});
