import { RepositorioEscaneres } from '../src/escaneres/RepositorioEscaneres';
import type { EscanerGuardado } from '../src/tipos/escaner';

class Memoria {
  datos = new Map<string, string>();
  fallarEscritura = false;

  async getItem(clave: string): Promise<string | null> {
    return this.datos.get(clave) ?? null;
  }

  async setItem(clave: string, valor: string): Promise<void> {
    if (this.fallarEscritura) {
      throw new Error('sin espacio');
    }
    this.datos.set(clave, valor);
  }
}

const escaner = (id: string): EscanerGuardado => ({
  id,
  nombre: `OBD ${id}`,
  nombreLocal: null,
  identificacionElm: 'ELM327 v1.5',
  verificadoEn: '2026-08-28T10:00:00.000Z',
  escritura: { uuidServicio: 'fff0', uuidCaracteristica: 'fff1' },
  notificacion: { uuidServicio: 'fff0', uuidCaracteristica: 'fff1' },
});

describe('repositorio de escáneres', () => {
  test('persiste, actualiza por id y sobrevive a otra instancia', async () => {
    const memoria = new Memoria();
    const primero = new RepositorioEscaneres(memoria);
    await primero.guardar(escaner('A'));
    await primero.guardar({
      ...escaner('A'),
      identificacionElm: 'ELM327 v2.1',
    });

    await expect(new RepositorioEscaneres(memoria).cargar()).resolves.toEqual([
      expect.objectContaining({ id: 'A', identificacionElm: 'ELM327 v2.1' }),
    ]);
  });

  test('serializa escrituras concurrentes sin perder escáneres', async () => {
    const repositorio = new RepositorioEscaneres(new Memoria());

    await Promise.all([
      repositorio.guardar(escaner('A')),
      repositorio.guardar(escaner('B')),
    ]);

    expect((await repositorio.cargar()).map(item => item.id)).toEqual([
      'B',
      'A',
    ]);
  });

  test('una escritura fallida no modifica el contenido anterior', async () => {
    const memoria = new Memoria();
    const repositorio = new RepositorioEscaneres(memoria);
    await repositorio.guardar(escaner('A'));
    memoria.fallarEscritura = true;

    await expect(repositorio.guardar(escaner('B'))).rejects.toThrow(
      'sin espacio',
    );
    memoria.fallarEscritura = false;
    await expect(repositorio.cargar()).resolves.toEqual([
      expect.objectContaining({ id: 'A' }),
    ]);
  });

  test('rechaza JSON desconocido sin sobrescribirlo', async () => {
    const memoria = new Memoria();
    memoria.datos.set('escaneres-verificados', '{"version":99,"escaneres":[]}');
    const repositorio = new RepositorioEscaneres(memoria);

    await expect(repositorio.guardar(escaner('A'))).rejects.toThrow('formato');
    expect(memoria.datos.get('escaneres-verificados')).toContain(
      '"version":99',
    );
  });
});
