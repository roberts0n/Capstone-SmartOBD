import { translateObdResponse } from '../src/obd/Elm327Service';
import {
  asciiToBase64,
  base64ToBytes,
  ObdResponseBuffer,
} from '../src/obd/ObdResponseBuffer';

describe('codificación y buffer ELM327', () => {
  test('codifica el comando ASCII con retorno de carro', () => {
    const encoded = asciiToBase64('ATI\r');
    expect(String.fromCharCode(...base64ToBytes(encoded))).toBe('ATI\r');
  });

  test('acumula notificaciones fragmentadas hasta el prompt', () => {
    const buffer = new ObdResponseBuffer();
    buffer.appendBase64(asciiToBase64('41 0C '));
    expect(buffer.isComplete()).toBe(false);
    buffer.appendBase64(asciiToBase64('1A F8\r>'));
    expect(buffer.isComplete()).toBe(true);
    expect(buffer.consume().ascii).toBe('41 0C 1A F8\r>');
  });
});

describe('traducción OBD2', () => {
  test('traduce RPM con y sin espacios', () => {
    expect(translateObdResponse('010C', '41 0C 1A F8\r>').value).toBe(1726);
    expect(translateObdResponse('010C', '410C1AF8\r>').value).toBe(1726);
  });

  test('traduce temperatura', () => {
    expect(translateObdResponse('0105', '41057B\r>')).toEqual({
      value: 83,
      unit: '°C',
      error: null,
    });
  });

  test('traduce DTC sin inventar descripciones', () => {
    expect(translateObdResponse('03', '43 01 33 00 00\r>').value).toEqual([
      'P0133',
    ]);
  });
});
