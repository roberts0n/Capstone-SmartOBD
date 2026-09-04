import { NativeModules, Platform } from 'react-native';
import { RepositorioInformeDtc } from '../src/informes/RepositorioInformeDtc';
import { guardarInformeDtc } from '../src/informes/guardarInformeDtc';
import type { InformePruebaDtc } from '../src/obd/dtc/PruebaDtc';

const informe = {
  versionEsquema: 2,
  versionPrueba: 'test',
  versionAplicacion: 'test',
  inicio: '2026-09-02T00:00:00.000Z',
  fin: null,
  estado: 'en-curso',
  dispositivo: { id: 'prueba', nombre: 'Sintetico' },
  canales: {},
  condiciones: '',
  advertencias: [],
  resumen: {
    cantidadCodigosUnicos: 0,
    codigosUnicos: [],
    categorias: { '03': null, '07': null, '0A': null },
  },
  capturas: [],
} as unknown as InformePruebaDtc;

describe('persistencia y exportacion DTC', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => {
    delete NativeModules.InformesDtc;
    jest.restoreAllMocks();
  });
  test('recupera un lote interrumpido sin simular finalizacion', async () => {
    const almacenamiento = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(informe)),
      setItem: jest.fn(),
    };
    const r = await new RepositorioInformeDtc(almacenamiento).recuperar();
    expect(r?.estado).toBe('interrumpida');
    expect(r?.fin).toBeNull();
  });
  test('migra borrador anterior conservando solo el resultado corregido', async () => {
    const anterior = {
      ...informe,
      versionEsquema: 1,
      resumen: undefined,
      capturas: [
        {
          numero: 1,
          fase: 'con-cabeceras',
          comando: '07',
          fecha: '2026-09-02T00:00:00.000Z',
          contexto: { protocolo: 'A6', cabeceras: true },
          respuesta: null,
          error: null,
          comparacion: {
            original: { codigos: ['P007E'] },
            porLineas: { codigos: ['P0243'] },
            corregido: {
              comando: '07',
              categoria: 'Pendientes',
              estado: 'con-codigos',
              codigos: ['P0104'],
              mensajes: [],
              advertencias: [],
            },
          },
        },
      ],
    };
    const almacenamiento = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(anterior)),
      setItem: jest.fn(),
    };
    const recuperado = await new RepositorioInformeDtc(
      almacenamiento,
    ).recuperar();
    expect(recuperado?.versionEsquema).toBe(2);
    expect(recuperado?.resumen.codigosUnicos).toEqual(['P0104']);
    expect(JSON.stringify(recuperado)).not.toContain('P007E');
    expect(JSON.stringify(recuperado)).not.toContain('P0243');
  });
  test('JSON corrupto no se borra', async () => {
    const almacenamiento = {
      getItem: jest.fn().mockResolvedValue('corrupto'),
      setItem: jest.fn(),
    };
    await expect(
      new RepositorioInformeDtc(almacenamiento).recuperar(),
    ).rejects.toThrow();
    expect(almacenamiento.setItem).not.toHaveBeenCalled();
  });
  test('envia JSON real y nombre al selector nativo', async () => {
    const guardarJson = jest
      .fn()
      .mockResolvedValue('content://destino/informe.json');
    NativeModules.InformesDtc = { guardarJson };
    expect(await guardarInformeDtc(informe)).toBe(
      'content://destino/informe.json',
    );
    expect(JSON.parse(guardarJson.mock.calls[0][1])).toEqual(informe);
    expect(guardarJson.mock.calls[0][0]).toMatch(/\.json$/);
  });
  test('cancelar selector no significa archivo guardado', async () => {
    NativeModules.InformesDtc = {
      guardarJson: jest.fn().mockResolvedValue(null),
    };
    await expect(guardarInformeDtc(informe)).resolves.toBeNull();
  });
  test('modulo ausente explica que debe recompilarse', async () => {
    await expect(guardarInformeDtc(informe)).rejects.toThrow('recompilar');
  });
});
