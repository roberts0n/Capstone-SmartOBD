import {
  interpretarDtc,
  numeroProtocolo,
  type ContextoDtc,
} from '../src/obd/dtc/InterpretarDtc';

const can: ContextoDtc = { protocolo: 'A6\r>', cabeceras: false };
const cabeceras: ContextoDtc = { ...can, cabeceras: true };
const iso: ContextoDtc = { protocolo: '3', cabeceras: false };

describe('DTC con protocolo conocido', () => {
  test('reproduce la foto: CAN sin almacenados no es respuesta incompleta', () => {
    const cruda = '03\r43 00 \r43 00 \r\r>';
    const resultado = interpretarDtc('03', cruda, can);
    expect(resultado).toMatchObject({
      estado: 'sin-codigos',
      codigos: [],
    });
    expect(resultado.codigos).not.toContain('P0043');
    expect(resultado.mensajes).toHaveLength(2);
  });
  test.each(['03', '07', '0A'] as const)(
    'interpreta categoria %s con contador',
    comando => {
      const servicio = { '03': '43', '07': '47', '0A': '4A' }[comando];
      expect(
        interpretarDtc(comando, `${servicio} 01 01 04\r>`, can),
      ).toMatchObject({ estado: 'con-codigos', codigos: ['P0104'] });
    },
  );
  test('captura real separa P0104 pendiente por ECU sin codigos falsos', () => {
    const almacenados = interpretarDtc(
      '03',
      '7E8 02 43 00\r7E9 02 43 00\r>',
      cabeceras,
    );
    const pendientes = interpretarDtc(
      '07',
      '7E8 04 47 01 01 04\r7E9 02 47 00\r>',
      cabeceras,
    );
    expect(almacenados).toMatchObject({ estado: 'sin-codigos', codigos: [] });
    expect(pendientes.codigos).toEqual(['P0104']);
    expect(pendientes.mensajes[0]).toMatchObject({
      ecu: '7E8',
      codigos: ['P0104'],
    });
    expect(pendientes.codigos).not.toEqual(
      expect.arrayContaining(['P0043', 'P007E', 'P0243']),
    );
  });
  test('CAN compacto y eco con espacios', () => {
    expect(interpretarDtc('03', '0 3\r43010104\r>', can).codigos).toEqual([
      'P0104',
    ]);
  });
  test('CAN simple elimina PCI y padding sin convertirlos en DTC', () => {
    expect(
      interpretarDtc('03', '7E8 04 43 01 01 04 00 00 00\r>', cabeceras),
    ).toMatchObject({ estado: 'con-codigos', codigos: ['P0104'] });
  });
  test('CAN con DLC visible', () => {
    expect(
      interpretarDtc('03', '7E8 8 04 43 01 01 04 00 00 00\r>', cabeceras)
        .codigos,
    ).toEqual(['P0104']);
  });
  test.each([
    '18DAF110 04 43 01 01 04 00 00 00',
    '18 DA F1 10 04 43 01 01 04 00 00 00',
  ])('CAN 29 bits %s', trama => {
    expect(
      interpretarDtc('03', `${trama}\r>`, { protocolo: 'A8', cabeceras: true })
        .codigos,
    ).toEqual(['P0104']);
  });
  test('deduplica codigos pero conserva ECU separadas', () => {
    const resultado = interpretarDtc(
      '03',
      '7E8 04 43 01 01 04\r7E9 04 43 01 01 04\r>',
      cabeceras,
    );
    expect(resultado.codigos).toEqual(['P0104']);
    expect(resultado.mensajes.map(m => m.ecu)).toEqual(['7E8', '7E9']);
  });
  test('reensambla ISO-TP por ECU aunque las tramas se intercalen', () => {
    const resultado = interpretarDtc(
      '03',
      '7E8 10 0A 43 04 01 04 01 33\r7E9 02 43 00\r7E8 21 02 00 03 00 00 00 00\r>',
      cabeceras,
    );
    expect(resultado.estado).toBe('con-codigos');
    expect(resultado.codigos).toEqual(['P0104', 'P0133', 'P0200', 'P0300']);
  });
  test('reensambla bloques numerados CAF1 completos', () => {
    const resultado = interpretarDtc(
      '03',
      '00A\r0: 43 04 01 04 01 33\r1: 02 00 03 00\r>',
      can,
    );
    expect(resultado.codigos).toEqual(['P0104', 'P0133', 'P0200', 'P0300']);
  });
  test('no une bloques formateados ambiguos de ECU desconocidas', () => {
    const resultado = interpretarDtc(
      '03',
      '00A\r0: 43 04 01 04 01 33\r00A\r0: 43 04 01 04 01 33\r1: 02 00 03 00\r>',
      can,
    );
    expect(resultado.codigos).toEqual([]);
    expect(resultado.estado).toBe('invalida');
  });
  test.each([
    '43 02 01 04\r>',
    '43 00 01 04\r>',
    '43 01 00 00\r>',
    '7E8 04 43 01\r>',
    '7E8 10 0A 43 04 01 04 01 33\r>',
    '7E8 10 0A 43 04 01 04 01 33\r7E8 22 02 00 03 00 00 00 00\r>',
  ])('no presenta datos malformados como lista vacia valida: %s', cruda => {
    expect(
      interpretarDtc('03', cruda, cruda.startsWith('7E8') ? cabeceras : can)
        .estado,
    ).toBe('invalida');
  });
  test('respuestas validas e invalidas dan parcial, no exito global', () => {
    const r = interpretarDtc('03', '43 01 01 04\r43 02 01 04\r>', can);
    expect(r).toMatchObject({ estado: 'parcial', codigos: ['P0104'] });
  });
  test.each([
    ['NO DATA\r>', 'sin-datos'],
    ['?\r>', 'no-soportado'],
    ['7F 03 11\r>', 'no-soportado'],
    ['7F 03 12\r>', 'no-soportado'],
    ['7F 03 78\r>', 'respuesta-negativa'],
    ['CAN ERROR\r>', 'invalida'],
    ['47 01 01 04\r>', 'invalida'],
  ])('distingue estados sin concluir cero DTC: %s', (cruda, estado) => {
    expect(interpretarDtc('03', cruda, can).estado).toBe(estado);
  });
  test('no asume CAN sin ATDPN', () => {
    expect(
      interpretarDtc('03', '43 00\r>', { protocolo: null, cabeceras: false })
        .estado,
    ).toBe('protocolo-desconocido');
    expect(numeroProtocolo('ATDPN\rA6\r>')).toBe(6);
    expect(numeroProtocolo('AUTO\r>')).toBeNull();
  });
  test('sin prompt no da resultado completo', () => {
    expect(interpretarDtc('03', '43 01 01 04', can).estado).toBe('parcial');
  });
  test('no CAN conserva pares y relleno nulo', () => {
    expect(interpretarDtc('03', '43 01 04 00 00\r>', iso)).toMatchObject({
      estado: 'con-codigos',
      codigos: ['P0104'],
    });
    expect(interpretarDtc('03', '43 00\r>', iso).estado).toBe('invalida');
  });
  test('ISO9141 con cabecera y checksum', () => {
    expect(
      interpretarDtc('03', '48 6B 10 43 01 04 0B\r>', {
        ...iso,
        cabeceras: true,
      }).codigos,
    ).toEqual(['P0104']);
    expect(
      interpretarDtc('03', '48 6B 10 43 01 04 00\r>', {
        ...iso,
        cabeceras: true,
      }).estado,
    ).toBe('invalida');
  });
  test('KWP con cabecera y longitud', () => {
    expect(
      interpretarDtc('03', '83 F1 10 43 01 04 CC\r>', {
        protocolo: '5',
        cabeceras: true,
      }).codigos,
    ).toEqual(['P0104']);
  });
});
