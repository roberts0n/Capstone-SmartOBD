import {
  construirResumenDtc,
  VERSION_PRUEBA_DTC,
  type CapturaPruebaDtc,
  type InformePruebaDtc,
} from '../obd/dtc/PruebaDtc';

interface Almacenamiento {
  getItem: (clave: string) => Promise<string | null>;
  setItem: (clave: string, valor: string) => Promise<void>;
}

const CLAVE = 'ultima-prueba-dtc-v1';

/** Conserva el ultimo informe, no un historial ilimitado de lecturas. */
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
    const leido: unknown = JSON.parse(texto);
    const datos = migrarInformeAnterior(leido);
    if (!esInformeValido(datos)) {
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
          'La app se cerro durante la lectura. Este es el ultimo avance guardado.',
        ],
      };
    }
    return datos;
  }
}

function migrarInformeAnterior(valor: unknown): unknown {
  if (!esObjeto(valor) || valor.versionEsquema !== 1) {
    return valor;
  }
  if (!Array.isArray(valor.capturas)) {
    return valor;
  }
  const capturas = valor.capturas.map(captura => {
    if (!esObjeto(captura)) {
      return captura;
    }
    const comparacion = esObjeto(captura.comparacion)
      ? captura.comparacion
      : null;
    const resto = { ...captura };
    delete resto.comparacion;
    return {
      ...resto,
      resultadoDtc: comparacion?.corregido ?? null,
    };
  }) as CapturaPruebaDtc[];
  const advertencias = Array.isArray(valor.advertencias)
    ? valor.advertencias.filter(
        aviso =>
          typeof aviso === 'string' &&
          !/original|por lineas|histor/i.test(aviso),
      )
    : [];
  return {
    ...valor,
    versionEsquema: 2,
    versionPrueba: VERSION_PRUEBA_DTC,
    capturas,
    resumen: construirResumenDtc(capturas),
    advertencias: [
      ...advertencias,
      'Borrador anterior migrado: se conservaron solo el interprete corregido y las respuestas crudas.',
    ],
  };
}

function esInformeValido(valor: unknown): valor is InformePruebaDtc {
  if (!esObjeto(valor)) {
    return false;
  }
  return (
    valor.versionEsquema === 2 &&
    Array.isArray(valor.capturas) &&
    Array.isArray(valor.advertencias) &&
    valor.advertencias.every(aviso => typeof aviso === 'string') &&
    typeof valor.inicio === 'string' &&
    Number.isFinite(Date.parse(valor.inicio)) &&
    typeof valor.estado === 'string' &&
    ['en-curso', 'completada', 'parcial', 'cancelada', 'interrumpida'].includes(
      valor.estado,
    ) &&
    esObjeto(valor.dispositivo) &&
    esObjeto(valor.canales) &&
    esObjeto(valor.resumen) &&
    valor.capturas.every(esCapturaValida)
  );
}

function esCapturaValida(valor: unknown): boolean {
  if (!esObjeto(valor)) {
    return false;
  }
  return (
    typeof valor.comando === 'string' &&
    typeof valor.numero === 'number' &&
    typeof valor.fase === 'string' &&
    esObjeto(valor.contexto) &&
    (valor.respuesta === null ||
      (esObjeto(valor.respuesta) &&
        typeof valor.respuesta.textoAscii === 'string')) &&
    (valor.resultadoDtc === null || esResultadoDtcValido(valor.resultadoDtc))
  );
}

function esResultadoDtcValido(valor: unknown): boolean {
  return (
    esObjeto(valor) &&
    typeof valor.estado === 'string' &&
    Array.isArray(valor.codigos) &&
    valor.codigos.every(codigo => typeof codigo === 'string') &&
    Array.isArray(valor.advertencias) &&
    valor.advertencias.every(aviso => typeof aviso === 'string')
  );
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}
