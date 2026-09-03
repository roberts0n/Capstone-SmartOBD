import {
  consolidarDeteccionPids,
  interpretarBloquePids,
} from '../src/obd/DeteccionPids';

describe('deteccion de PID Mode 01', () => {
  test('reproduce las mascaras del segundo vehiculo: 28 soportados y ahora 28 traducibles', () => {
    const resultado = consolidarDeteccionPids([
      interpretarBloquePids(
        '0100',
        '0100\r41 00 98 3B A0 13\r41 00 98 18 00 01\r>',
      ),
      interpretarBloquePids(
        '0120',
        '0120\r41 20 B0 19 A0 01\r41 20 00 00 00 01\r>',
      ),
      interpretarBloquePids(
        '0140',
        '0140\r41 40 CC D2 00 00\r41 40 C0 80 00 00\r>',
      ),
    ]);
    expect(resultado.cantidadPidsSoportados).toBe(28);
    expect(resultado.cantidadInterpretables).toBe(28);
    expect(resultado.pidsPendientes).toEqual([]);
    expect(resultado.pidsInterpretables).toEqual([
      '0101',
      '0104',
      '0105',
      '010B',
      '010C',
      '010D',
      '010F',
      '0110',
      '0111',
      '0113',
      '011C',
      '011F',
      '0121',
      '0123',
      '0124',
      '012C',
      '012D',
      '0130',
      '0131',
      '0133',
      '0141',
      '0142',
      '0145',
      '0146',
      '0149',
      '014A',
      '014C',
      '014F',
    ]);
  });

  test('sigue detectando bloques fuera de 5F y los informa como pendientes', () => {
    const bloques = [
      interpretarBloquePids('0140', '41 40 00 00 00 01'),
      interpretarBloquePids('0160', '41 60 80 00 00 00'),
    ];
    expect(bloques[0].siguienteComando).toBe('0160');
    const resultado = consolidarDeteccionPids(bloques);
    expect(resultado.pidsPendientes).toEqual(['0161']);
    expect(resultado.cantidadPidsSoportados).toBe(1);
  });
  test('decodifica una mascara y solicita el bloque siguiente', () => {
    const bloque = interpretarBloquePids('0100', '7E8 06 41 00 88 10 00 01\r>');

    expect(bloque.mascaraHexadecimal).toBe('88 10 00 01');
    expect(bloque.pidsDeclarados).toEqual(['0101', '0105', '010C', '0120']);
    expect(bloque.siguienteComando).toBe('0120');
  });

  test('une las capacidades informadas por varias ECU', () => {
    const bloque = interpretarBloquePids(
      '0100',
      '7E8 06 41 00 80 00 00 00\r7E9 06 41 00 08 00 00 00\r>',
    );

    expect(bloque.pidsDeclarados).toEqual(['0101', '0105']);
    expect(bloque.siguienteComando).toBeNull();
  });

  test('consolida datos sin contar los PID de continuacion', () => {
    const primero = interpretarBloquePids('0100', '41 00 88 10 00 01\r>');
    const segundo = interpretarBloquePids('0120', '41 20 80 00 00 00\r>');
    const resultado = consolidarDeteccionPids([primero, segundo]);

    expect(resultado.pidsSoportados).toEqual(['0101', '0105', '010C', '0121']);
    expect(resultado.pidsInterpretables).toEqual([
      '0101',
      '0105',
      '010C',
      '0121',
    ]);
    expect(resultado.cantidadPidsSoportados).toBe(4);
    expect(resultado.cantidadPendientes).toBe(0);
  });

  test('distingue NO DATA de una mascara valida', () => {
    expect(() => interpretarBloquePids('0100', 'NO DATA\r>')).toThrow(
      '0100 devolvio NO DATA',
    );
  });
});
