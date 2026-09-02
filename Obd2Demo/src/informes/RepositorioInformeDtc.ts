import type { InformePruebaDtc } from '../obd/dtc/PruebaDtc';

interface Almacenamiento {
  getItem: (clave: string) => Promise<string | null>;
  setItem: (clave: string, valor: string) => Promise<void>;
}
const CLAVE = 'ultima-prueba-dtc-v1';

/** Conserva el ultimo lote, no un historial ilimitado de muestras. */
export class RepositorioInformeDtc {
  constructor(private readonly almacenamiento: Almacenamiento) {}

  guardar(informe: InformePruebaDtc): Promise<void> {
    return this.almacenamiento.setItem(CLAVE, JSON.stringify(informe));
  }

  async recuperar(): Promise<InformePruebaDtc | null> {
    const texto = await this.almacenamiento.getItem(CLAVE);
    if (texto === null) {
      return null;
    }
    const datos = JSON.parse(texto) as InformePruebaDtc;
    if (
      !datos ||
      datos.versionEsquema !== 1 ||
      !Array.isArray(datos.capturas) ||
      !Array.isArray(datos.advertencias) ||
      !datos.advertencias.every(valor => typeof valor === 'string') ||
      typeof datos.inicio !== 'string' ||
      !Number.isFinite(Date.parse(datos.inicio)) ||
      ![
        'en-curso',
        'completada',
        'parcial',
        'cancelada',
        'interrumpida',
      ].includes(datos.estado) ||
      !datos.dispositivo ||
      !datos.canales ||
      !datos.capturas.every(
        captura =>
          captura &&
          typeof captura.comando === 'string' &&
          typeof captura.numero === 'number' &&
          typeof captura.fase === 'string' &&
          captura.contexto &&
          (captura.respuesta === null ||
            (captura.respuesta &&
              typeof captura.respuesta.textoAscii === 'string')) &&
          (captura.comparacion === null ||
            (captura.comparacion &&
              [
                captura.comparacion.original,
                captura.comparacion.porLineas,
                captura.comparacion.corregido,
              ].every(
                metodo =>
                  metodo &&
                  typeof metodo.estado === 'string' &&
                  Array.isArray(metodo.codigos) &&
                  metodo.codigos.every(codigo => typeof codigo === 'string') &&
                  Array.isArray(metodo.advertencias) &&
                  metodo.advertencias.every(aviso => typeof aviso === 'string'),
              ))),
      )
    ) {
      throw new Error(
        'El borrador DTC no tiene un formato reconocido. Se conserva sin modificar.',
      );
    }
    if (datos.estado === 'en-curso') {
      return {
        ...datos,
        estado: 'interrumpida',
        advertencias: [
          ...datos.advertencias,
          'La app se cerro durante la prueba. Este es el ultimo avance guardado.',
        ],
      };
    }
    return datos;
  }
}
