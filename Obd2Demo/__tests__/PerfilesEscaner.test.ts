import {
  clasificarDispositivo,
  combinarAnuncios,
  normalizarUuid,
  ordenarCandidatos,
  type PerfilEscaner,
} from '../src/escaneres/PerfilesEscaner';
import type { InformacionDispositivoBle } from '../src/tipos/ble';
import type { EscanerGuardado } from '../src/tipos/escaner';

const dispositivo = (
  cambios: Partial<InformacionDispositivoBle> = {},
): InformacionDispositivoBle => ({
  id: 'AA:BB:CC:DD:EE:FF',
  nombre: null,
  nombreLocal: null,
  rssi: -65,
  ...cambios,
});

const guardado: EscanerGuardado = {
  id: 'AA:BB:CC:DD:EE:FF',
  nombre: 'OBDII',
  nombreLocal: null,
  identificacionElm: 'ELM327 v1.5',
  verificadoEn: '2026-08-28T10:00:00.000Z',
  escritura: { uuidServicio: 'fff0', uuidCaracteristica: 'fff1' },
  notificacion: { uuidServicio: 'fff0', uuidCaracteristica: 'fff1' },
};

describe('clasificación de escáneres', () => {
  test('marca como probable un nombre OBD y conserva la advertencia de indicio', () => {
    const resultado = clasificarDispositivo(dispositivo({ nombre: 'OBDII' }));

    expect(resultado.nivel).toBe('probable');
    expect(resultado.motivos.join(' ')).toContain('coincide el nombre');
  });

  test('un servicio serial genérico solo produce un candidato posible', () => {
    expect(
      clasificarDispositivo(
        dispositivo({
          serviciosAnunciados: ['0000fff0-0000-1000-8000-00805f9b34fb'],
        }),
      ).nivel,
    ).toBe('posible');
  });

  test('un dispositivo guardado tiene prioridad sobre las heurísticas', () => {
    expect(clasificarDispositivo(dispositivo(), [guardado]).nivel).toBe(
      'guardado',
    );
  });

  test('una firma completa de fabricante puede añadirse mediante un perfil', () => {
    const perfil: PerfilEscaner = {
      id: 'captura-documentada',
      nombre: 'Captura documentada',
      patronesNombre: [],
      serviciosAnunciados: [],
      prefijosFabricanteHex: ['01020304'],
    };
    const datosFabricante = 'AQIDBAUG';

    expect(
      clasificarDispositivo(dispositivo({ datosFabricante }), [], [perfil])
        .nivel,
    ).toBe('probable');
  });

  test('combina anuncios incompletos y normaliza UUID cortos', () => {
    const combinado = combinarAnuncios(
      dispositivo({ nombre: 'OBDII', serviciosAnunciados: ['FFF0'] }),
      dispositivo({ nombre: null, rssi: -41, serviciosAnunciados: null }),
    );

    expect(combinado.nombre).toBe('OBDII');
    expect(combinado.rssi).toBe(-41);
    expect(combinado.serviciosAnunciados).toEqual([normalizarUuid('FFF0')]);
  });

  test('ordena guardados y probables antes que desconocidos', () => {
    const resultados = ordenarCandidatos([
      clasificarDispositivo(dispositivo({ id: '3' })),
      clasificarDispositivo(dispositivo({ id: '2', nombre: 'ELM327' })),
      clasificarDispositivo(dispositivo({ id: guardado.id }), [guardado]),
    ]);

    expect(resultados.map(resultado => resultado.nivel)).toEqual([
      'guardado',
      'probable',
      'desconocido',
    ]);
  });
});
