import {
  ejecutarPruebaDtc,
  nombreInformeDtc,
  type OpcionesPruebaDtc,
} from '../src/obd/dtc/PruebaDtc';
import { ErrorCapturaElm } from '../src/obd/ServicioElm327';
import type { RespuestaElm } from '../src/tipos/ble';

export function respuesta(textoAscii: string): RespuestaElm {
  return {
    textoAscii,
    bytes: Array.from(textoAscii, c => c.charCodeAt(0)),
    fragmentos: [],
    metricasRecepcion: {
      inicioComandoMs: 0,
      escrituraBleCompletaMs: 1,
      primerFragmentoMs: 2,
      respuestaCompletaMs: 3,
      cantidadFragmentos: 1,
      cantidadBytes: textoAscii.length,
    },
  };
}

function preparar(): OpcionesPruebaDtc {
  let cabeceras = false;
  const canal = {
    uuidServicio: 'fff0',
    uuidCaracteristica: 'fff1',
    permiteLectura: false,
    permiteEscrituraConRespuesta: true,
    permiteEscrituraSinRespuesta: true,
    permiteNotificacion: true,
    permiteIndicacion: false,
  };
  return {
    dispositivo: {
      id: 'esc-test',
      nombre: 'Simulado',
      nombreLocal: null,
      rssi: -40,
    },
    escritura: canal,
    notificacion: canal,
    versionAplicacion: 'prueba',
    condiciones: 'Datos sinteticos',
    conectado: () => true,
    sincronizado: () => true,
    cancelado: () => false,
    guardarAvance: jest.fn().mockResolvedValue(undefined),
    alProgresar: jest.fn(),
    enviar: jest.fn(async comando => {
      if (comando === 'ATH0') {
        cabeceras = false;
      }
      if (comando === 'ATH1') {
        cabeceras = true;
      }
      if (comando === 'ATI') {
        return respuesta('ELM327 v1.5\r>');
      }
      if (comando === 'ATDP') {
        return respuesta('AUTO, ISO 15765-4 CAN (11 bit ID, 500 kbaud)\r>');
      }
      if (comando === 'ATDPN') {
        return respuesta('A6\r>');
      }
      if (comando === '0101') {
        return respuesta('41 01 00 00 00 00\r>');
      }
      if (comando === '03') {
        return respuesta(cabeceras ? '7E8 02 43 00\r>' : '43 00\r>');
      }
      if (comando === '07') {
        return respuesta(
          cabeceras ? '7E8 04 47 01 01 04\r>' : '47 01 01 04\r>',
        );
      }
      if (comando === '0A') {
        return respuesta('NO DATA\r>');
      }
      return respuesta('OK\r>');
    }),
  };
}

describe('lote DTC', () => {
  test('ejecuta dos pasadas y guarda avances sin borrar DTC', async () => {
    const opciones = preparar();
    const informe = await ejecutarPruebaDtc(opciones);
    expect(informe.estado).toBe('completada');
    expect(informe.capturas.filter(c => c.comparacion)).toHaveLength(6);
    expect(
      informe.capturas
        .filter(c => c.comando === '07')
        .every(c => c.comparacion?.corregido.codigos[0] === 'P0104'),
    ).toBe(true);
    expect(informe.capturas.at(-1)?.comando).toBe('ATH0');
    expect(
      informe.capturas.some(c => ['04', 'ATZ', 'ATSP0'].includes(c.comando)),
    ).toBe(false);
    expect(opciones.guardarAvance).toHaveBeenCalledTimes(
      informe.capturas.length + 2,
    );
    expect(nombreInformeDtc(informe)).toMatch(/^SmartOBD_DTC_.*\.json$/);
  });
  test('secuencial: nunca hay dos envios simultaneos', async () => {
    const opciones = preparar();
    const enviar = opciones.enviar;
    let activos = 0;
    let maximo = 0;
    opciones.enviar = async comando => {
      activos += 1;
      maximo = Math.max(maximo, activos);
      const resultado = await enviar(comando);
      activos -= 1;
      return resultado;
    };
    await ejecutarPruebaDtc(opciones);
    expect(maximo).toBe(1);
  });
  test('NO DATA no interrumpe consultas siguientes ni equivale a cero DTC', async () => {
    const informe = await ejecutarPruebaDtc(preparar());
    const permanentes = informe.capturas.filter(c => c.comando === '0A');
    expect(permanentes).toHaveLength(2);
    expect(permanentes[0].comparacion?.corregido.estado).toBe('sin-datos');
  });
  test('error con respuesta parcial conserva la evidencia y no cruza respuestas tardias', async () => {
    const opciones = preparar();
    const enviar = opciones.enviar;
    let sincronizado = true;
    opciones.sincronizado = () => sincronizado;
    opciones.enviar = async comando => {
      if (comando === '07') {
        sincronizado = false;
        throw new ErrorCapturaElm('Timeout simulado', respuesta('47 01'));
      }
      return enviar(comando);
    };
    const informe = await ejecutarPruebaDtc(opciones);
    expect(informe.estado).toBe('parcial');
    expect(informe.capturas.at(-1)).toMatchObject({
      comando: '07',
      error: 'Timeout simulado',
      respuesta: { textoAscii: '47 01' },
    });
    expect(informe.advertencias.join(' ')).toContain('prompt');
  });
  test('cancelacion espera al comando actual y restaura cabeceras', async () => {
    const opciones = preparar();
    const enviar = opciones.enviar;
    let cancelado = false;
    opciones.cancelado = () => cancelado;
    opciones.enviar = async comando => {
      if (comando === '07') {
        cancelado = true;
      }
      return enviar(comando);
    };
    const informe = await ejecutarPruebaDtc(opciones);
    expect(informe.estado).toBe('cancelada');
    expect(informe.capturas.at(-1)?.comando).toBe('ATH0');
    expect(informe.capturas.some(c => c.comando === '0A')).toBe(false);
  });
  test('fallo de borrador no impide completar y exportar desde memoria', async () => {
    const opciones = preparar();
    opciones.guardarAvance = jest
      .fn()
      .mockRejectedValue(new Error('Disco lleno'));
    const informe = await ejecutarPruebaDtc(opciones);
    expect(informe.capturas.filter(c => c.comparacion)).toHaveLength(6);
    expect(
      informe.advertencias.filter(a => a.includes('borrador')),
    ).toHaveLength(1);
  });
  test('no da por activadas cabeceras si ATH1 devuelve interrogacion', async () => {
    const opciones = preparar();
    const enviar = opciones.enviar;
    opciones.enviar = cmd =>
      cmd === 'ATH1' ? Promise.resolve(respuesta('?\r>')) : enviar(cmd);
    const informe = await ejecutarPruebaDtc(opciones);
    expect(informe.estado).toBe('parcial');
    expect(informe.capturas.filter(c => c.comparacion)).toHaveLength(3);
  });
  test('informe serializado conserva exactamente separadores originales', async () => {
    const informe = await ejecutarPruebaDtc(preparar());
    const copia = JSON.parse(JSON.stringify(informe));
    expect(copia.capturas[0].respuesta.textoAscii).toBe('ELM327 v1.5\r>');
  });
});
