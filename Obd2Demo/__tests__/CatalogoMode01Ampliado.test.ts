import {
  CATALOGO_PIDS_MODE_01,
  obtenerConsultasConfiguracion,
  traducirPidMode01,
} from '../src/obd/CatalogoPidsMode01';
import { traducirRespuestaObd } from '../src/obd/ServicioElm327';
import { extraerRespuestasPid } from '../src/obd/mode01/ExtraerRespuestaPid';

const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
const consultar = (pid: string, datos: string) =>
  traducirPidMode01(`01${pid}`, `41 ${pid} ${datos}\r>`)!;

test('cubre exactamente 01..5F salvo los bloques de compatibilidad, sin duplicados', () => {
  const esperados = Array.from({ length: 95 }, (_, i) => i + 1)
    .filter(i => i !== 32 && i !== 64)
    .map(i => `01${hex(i)}`);
  expect(CATALOGO_PIDS_MODE_01.map(d => d.comando)).toEqual(esperados);
  expect(new Set(esperados).size).toBe(93);
  for (const pid of ['0100', '0120', '0140', '0160', '0199']) {
    expect(traducirPidMode01(pid, 'NO DATA')).toBeNull();
  }
});

test.each(CATALOGO_PIDS_MODE_01)(
  '$comando valida longitud, bytes y limites sin inventar datos',
  d => {
    for (const valor of ['00', 'FF']) {
      const respuesta = `41 ${d.comando.slice(2)} ${Array(d.bytesEsperados)
        .fill(valor)
        .join(' ')}`;
      const traduccion = traducirPidMode01(d.comando, respuesta)!;
      expect(traduccion.error).toBeNull();
      expect(JSON.stringify(traduccion)).not.toMatch(/NaN|Infinity|undefined/);
    }
    const corta = Array(d.bytesEsperados - 1)
      .fill('00')
      .join(' ');
    const incompleta = traducirPidMode01(
      d.comando,
      `41 ${d.comando.slice(2)} ${corta}`,
    )!;
    expect(incompleta.valor).toBeNull();
    expect(incompleta.error).toBeTruthy();
    expect(
      traducirPidMode01(d.comando, `41 ${d.comando.slice(2)} ZZ`)!.valor,
    ).toBeNull();
  },
);

test.each([
  ['0A', '20', 96, 'kPa'],
  ['10', '01 F4', 5, 'g/s'],
  ['1F', '01 2C', 300, 's'],
  ['22', '01 F4', 39.5, 'kPa'],
  ['23', '01 F4', 5000, 'kPa'],
  ['2C', 'FF', 100, '%'],
  ['2D', '70', -12.5, '%'],
  ['2F', '80', 50.2, '%'],
  ['32', 'FF FC', -1, 'Pa'],
  ['32', '80 00', -8192, 'Pa'],
  ['32', '7F FF', 8191.75, 'Pa'],
  ['33', '64', 100, 'kPa'],
  ['3C', '0F A0', 360, '°C'],
  ['3D', '00 00', -40, '°C'],
  ['3E', '01 90', 0, '°C'],
  ['3F', 'FF FF', 6513.5, '°C'],
  ['42', '36 B0', 14, 'V'],
  ['43', '02 FD', 300, '%'],
  ['44', '80 00', 1, 'lambda'],
  ['46', '41', 25, '°C'],
  ['48', 'FF', 100, '%'],
  ['49', '80', 50.2, '%'],
  ['4A', '40', 25.1, '%'],
  ['4B', '00', 0, '%'],
  ['4D', '00 3C', 60, 'min'],
  ['4E', '01 2C', 300, 'min'],
  ['52', 'FF', 100, '%'],
  ['53', '4E 20', 100, 'kPa'],
  ['54', '7F FF', 0, 'Pa'],
  ['54', '00 00', -32767, 'Pa'],
  ['54', 'FF FF', 32768, 'Pa'],
  ['59', '01 F4', 5000, 'kPa'],
  ['5A', '80', 50.2, '%'],
  ['5B', 'FF', 100, '%'],
  ['5C', '64', 60, '°C'],
  ['5D', '69 00', 0, '°'],
  ['5D', '00 00', -210, '°'],
  ['5E', '00 64', 5, 'L/h'],
])('%s: vector conocido con unidad', (pid, bytes, valor, unidad) => {
  expect(consultar(pid as string, bytes as string)).toEqual({
    valor,
    unidad,
    error: null,
  });
});

test.each(Array.from({ length: 8 }, (_, i) => i))(
  'familias O2: posicion %i',
  i => {
    expect(consultar(hex(0x14 + i), '80 FF').valor).toMatchObject({
      voltaje: 0.64,
      ajusteCombustible: null,
    });
    expect(consultar(hex(0x24 + i), '80 00 20 00').valor).toMatchObject({
      lambda: 1,
      voltaje: 1,
    });
    expect(consultar(hex(0x34 + i), '80 00 7F 00').valor).toMatchObject({
      lambda: 1,
      corriente: -1,
    });
  },
);

test.each(['06', '07', '08', '09', '55', '56', '57', '58'])(
  '%s interpreta uno o dos bancos',
  pid => {
    expect(consultar(pid, '90')).toEqual({
      valor: 12.5,
      unidad: '%',
      error: null,
    });
    const bancos = ['06', '07', '55', '56'].includes(pid) ? [1, 3] : [2, 4];
    expect(consultar(pid, '90 70').valor).toEqual({
      [`banco${bancos[0]}`]: 12.5,
      [`banco${bancos[1]}`]: -12.5,
      unidad: '%',
    });
    expect(consultar(pid, 'FF').valor).toBe(99.22);
  },
);

test('interpreta los estados sin confundir codigo reservado, ausencia y valor cero', () => {
  expect(consultar('02', '01 04').valor).toEqual({
    codigoDtc: 'P0104',
    cuadroCongeladoDisponible: true,
  });
  expect(consultar('02', 'C1 23').valor).toMatchObject({ codigoDtc: 'U0123' });
  expect(consultar('02', '00 00').valor).toMatchObject({
    codigoDtc: null,
    cuadroCongeladoDisponible: false,
  });
  expect(consultar('12', '08').valor).toMatchObject({
    codigo: 8,
    descripcion: 'Bomba activada para diagnóstico',
  });
  expect(consultar('12', '80').valor).toMatchObject({
    codigo: 128,
    descripcion: 'Estado reservado o no reconocido',
  });
  expect(consultar('1D', '81').valor).toEqual({
    sensoresPresentes: ['Banco 1 Sensor 1', 'Banco 4 Sensor 2'],
  });
  expect(consultar('1E', '01').valor).toMatchObject({
    tomaDeFuerzaActiva: true,
  });
  expect(consultar('1E', '00').valor).toMatchObject({
    tomaDeFuerzaActiva: false,
  });
  expect(consultar('51', '04').valor).toMatchObject({
    descripcion: 'Diésel',
    disponible: true,
  });
  expect(consultar('51', '00').valor).toMatchObject({ disponible: false });
  expect(consultar('51', 'FF').valor).toMatchObject({
    codigo: 255,
    disponible: false,
  });
  expect(consultar('5F', '0E').valor).toMatchObject({
    descripcion: 'EURO IV B1',
  });
  expect(consultar('5F', 'FF').valor).toMatchObject({
    codigo: 255,
    descripcion: expect.stringContaining('no definido'),
  });
});

test('41 no inventa MIL ni cantidad DTC y distingue habilitacion de soporte', () => {
  const valor = consultar('41', '00 17 01 01').valor;
  expect(valor).not.toHaveProperty('cantidadDtc');
  expect(valor).not.toHaveProperty('milEncendida');
  expect(valor).toMatchObject({
    tipoEncendido: 'chispa',
    monitores: expect.arrayContaining([
      {
        nombre: 'Fallas de encendido',
        habilitadoEsteCiclo: true,
        completado: false,
      },
      { nombre: 'Catalizador', habilitadoEsteCiclo: true, completado: false },
      {
        nombre: 'Sistema evaporativo',
        habilitadoEsteCiclo: false,
        completado: null,
      },
    ]),
  });
  expect(consultar('41', '00 0F 80 00').valor).toMatchObject({
    tipoEncendido: 'compresión',
  });
});

test('4F y 50 son configuracion; cero significa usar escala estandar', () => {
  expect(consultar('4F', '04 10 40 4D').valor).toMatchObject({
    maximoLambda: 4,
    maximoVoltajeOxigeno: 16,
    maximoCorrienteOxigeno: 64,
    maximoPresionAdmision: 770,
  });
  expect(consultar('4F', '00 00 00 00').valor).toMatchObject({
    maximoLambda: null,
    maximoPresionAdmision: null,
  });
  expect(consultar('50', '64 00 00 00').valor).toMatchObject({
    maximoCaudal: 1000,
  });
  expect(consultar('50', '00 00 00 00').valor).toMatchObject({
    maximoCaudal: null,
  });
});

test('usa las escalas ampliadas y conserva el cero como seleccion de escala base', () => {
  const contexto = {
    pidsSoportados: ['014F', '0150'],
    respuestasConfiguracion: {
      '014F': '41 4F 04 10 40 4D',
      '0150': '41 50 64 00 00 00',
    },
  };
  expect(traducirRespuestaObd('010B', '41 0B 7F', contexto).valor).toBe(383.49);
  expect(traducirRespuestaObd('0110', '41 10 E2 90', contexto).valor).toBe(
    885.02,
  );
  expect(
    traducirRespuestaObd('0124', '41 24 7D 00 9C 40', contexto).valor,
  ).toMatchObject({ lambda: 1.9532, voltaje: 9.7658 });
  expect(
    traducirRespuestaObd('0134', '41 34 80 00 9C 40', contexto).valor,
  ).toMatchObject({ corriente: 14.125 });
  expect(traducirRespuestaObd('0144', '41 44 80 00', contexto).valor).toBe(2);
  expect(
    traducirRespuestaObd('010B', '41 0B 7F', {
      ...contexto,
      respuestasConfiguracion: { '014F': '41 4F 00 00 00 00' },
    }).valor,
  ).toBe(127);
});

test('asocia escalas por ECU, nunca usa la escala de otro modulo ni adivina sin cabeceras', () => {
  const contexto = {
    pidsSoportados: ['014F'],
    respuestasConfiguracion: {
      '014F': '7E8 06 41 4F 00 00 00 00\r7E9 06 41 4F 00 00 00 4D',
    },
  };
  expect(traducirRespuestaObd('010B', '7E9 03 41 0B 7F', contexto).valor).toBe(
    383.49,
  );
  expect(
    traducirRespuestaObd('010B', '7EA 03 41 0B 7F', contexto).valor,
  ).toBeNull();
  expect(traducirRespuestaObd('010B', '41 0B 7F', contexto).error).toContain(
    'configuración',
  );
  const sinCabecera = {
    pidsSoportados: ['014F'],
    respuestasConfiguracion: { '014F': '41 4F 00 00 00 4D' },
  };
  expect(
    traducirRespuestaObd('010B', '41 0B 7F\r41 0B 64', sinCabecera).error,
  ).toContain('Varias respuestas');
  expect(
    traducirRespuestaObd('010B', '41 0B 7F', {
      pidsSoportados: ['014F'],
      respuestasConfiguracion: {},
    }).valor,
  ).toBeNull();
});

test('011D determina longitud y ubicacion de bancos, no confunde un byte ausente con cero', () => {
  const contexto = {
    pidsSoportados: ['011D'],
    respuestasConfiguracion: { '011D': '41 1D FF' },
  };
  expect(traducirRespuestaObd('0106', '41 06 90', contexto).valor).toBeNull();
  expect(
    traducirRespuestaObd('0106', '41 06 90 70', contexto).valor,
  ).toMatchObject({ banco1: 12.5, banco3: -12.5 });
  expect(
    traducirRespuestaObd('0118', '41 18 80 80', contexto).valor,
  ).toMatchObject({ sensor: 'Banco 3 Sensor 1' });
  expect(
    obtenerConsultasConfiguracion(['010C', '011D', '014F', '0150']),
  ).toEqual(['011D', '014F', '0150']);
  expect(obtenerConsultasConfiguracion(['010C', '0113'])).toEqual([]);
});

test.each([
  'NO DATA\r>',
  'UNABLE TO CONNECT\r>',
  'STOPPED\r>',
  '?\r>',
  '7F 01 12\r>',
  '41 05 00\r>',
  '',
])('no convierte %s en una lectura de RPM', respuesta => {
  expect(traducirRespuestaObd('010C', respuesta).valor).toBeNull();
  expect(traducirRespuestaObd('010C', respuesta).error).toBeTruthy();
});

test.each([
  '7E8 04 41 0C 1A F8 00 00 00',
  '7E804410C1AF8000000',
  '18DAF110 04 41 0C 1A F8 00 00 00',
  '18DAF11004410C1AF8000000',
  '010C\r410C1AF8\r>',
  '48 6B 10 41 0C 1A F8 22',
])('extrae el PID con formato %s', respuesta => {
  expect(traducirRespuestaObd('010C', respuesta).valor).toBe(1726);
});

test('no concatena ECU ni busca una cabecera de respuesta dentro de otro PID', () => {
  expect(consultar('0C', '1A\r41 0C F8').valor).toBeNull();
  expect(traducirRespuestaObd('010C', '41 24 41 0C 1A F8').valor).toBeNull();
  expect(traducirRespuestaObd('010C', '7E8 04 41 0C 1A').valor).toBeNull();
  expect(traducirRespuestaObd('010C', '7E8 03 41 0C 1A F8').valor).toBeNull();
  expect(
    extraerRespuestasPid(
      '7E8 06 41 4F 00 00 00 00\r7E9 06 41 4F 04 10 40 4D',
      0x4f,
    ),
  ).toHaveLength(2);
});
