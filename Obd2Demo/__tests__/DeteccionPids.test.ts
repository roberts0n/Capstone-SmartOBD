import {
  consolidarDeteccionPids,
  interpretarBloquePids,
} from '../src/obd/DeteccionPids';

describe('deteccion de PID Mode 01', () => {
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
