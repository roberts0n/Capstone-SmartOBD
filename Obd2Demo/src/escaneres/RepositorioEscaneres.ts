import type { EscanerGuardado } from '../tipos/escaner';
import { identificarElm } from './VerificacionElm';

interface AlmacenamientoTexto {
  getItem: (clave: string) => Promise<string | null>;
  setItem: (clave: string, valor: string) => Promise<void>;
}

const CLAVE = 'escaneres-verificados';

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function esCanal(valor: unknown): boolean {
  const uuidValido = (uuid: unknown) =>
    typeof uuid === 'string' &&
    /^(?:[a-f0-9]{4}|[a-f0-9]{8}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(
      uuid,
    );
  return (
    esObjeto(valor) &&
    uuidValido(valor.uuidServicio) &&
    uuidValido(valor.uuidCaracteristica)
  );
}

function esEscaner(valor: unknown): valor is EscanerGuardado {
  return (
    esObjeto(valor) &&
    typeof valor.id === 'string' &&
    valor.id.length > 0 &&
    (valor.nombre === null || typeof valor.nombre === 'string') &&
    (valor.nombreLocal === null || typeof valor.nombreLocal === 'string') &&
    typeof valor.identificacionElm === 'string' &&
    identificarElm(`${valor.identificacionElm}\r>`) !== null &&
    typeof valor.verificadoEn === 'string' &&
    Number.isFinite(Date.parse(valor.verificadoEn)) &&
    esCanal(valor.escritura) &&
    esCanal(valor.notificacion)
  );
}

/** Valida el JSON antes de escribir. Una lectura fallida nunca borra registros. */
export class RepositorioEscaneres {
  private cola: Promise<unknown> = Promise.resolve();

  constructor(private readonly almacenamiento: AlmacenamientoTexto) {}

  async cargar(): Promise<EscanerGuardado[]> {
    const texto = await this.almacenamiento.getItem(CLAVE);
    if (texto === null) {
      return [];
    }
    const datos: unknown = JSON.parse(texto);
    if (
      !esObjeto(datos) ||
      datos.version !== 1 ||
      !Array.isArray(datos.escaneres) ||
      !datos.escaneres.every(esEscaner)
    ) {
      throw new Error(
        'El registro de escáneres no tiene un formato reconocido. Se conservó sin modificar.',
      );
    }
    return datos.escaneres;
  }

  guardar(escaner: EscanerGuardado): Promise<EscanerGuardado[]> {
    if (!esEscaner(escaner)) {
      return Promise.reject(
        new Error('No se puede guardar un escáner sin verificación válida.'),
      );
    }
    return this.modificar(actuales => [
      escaner,
      ...actuales.filter(actual => actual.id !== escaner.id),
    ]);
  }

  olvidar(id: string): Promise<EscanerGuardado[]> {
    return this.modificar(actuales =>
      actuales.filter(actual => actual.id !== id),
    );
  }

  private modificar(
    cambiar: (actuales: EscanerGuardado[]) => EscanerGuardado[],
  ): Promise<EscanerGuardado[]> {
    const operacion = this.cola.then(async () => {
      const siguientes = cambiar(await this.cargar());
      await this.almacenamiento.setItem(
        CLAVE,
        JSON.stringify({ version: 1, escaneres: siguientes }),
      );
      return siguientes;
    });
    // Serializa escrituras y permite reintentar tras un fallo de almacenamiento.
    this.cola = operacion.catch(() => undefined);
    return operacion;
  }
}
