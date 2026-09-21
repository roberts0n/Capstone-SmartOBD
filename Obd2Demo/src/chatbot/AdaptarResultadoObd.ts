import { obtenerDefinicionPidMode01 } from '../obd/CatalogoPidsMode01';
import type { ResultadoJsonObd } from '../tipos/ble';
import type {
  LecturaPidEntradaChatbot,
  OrigenLecturaChatbot,
  ValorLecturaChatbot,
} from './TiposChatbot';

export interface OpcionesAdaptarResultadoObd {
  casoId: string;
  resultado: ResultadoJsonObd;
  pidsCompatibles: readonly string[];
  origen: OrigenLecturaChatbot;
}

export function adaptarResultadoObd(
  opciones: OpcionesAdaptarResultadoObd,
): LecturaPidEntradaChatbot {
  const comando = opciones.resultado.comando.trim().toUpperCase();
  if (!/^01[0-9A-F]{2}$/.test(comando)) {
    throw new Error('El resultado no corresponde a una lectura PID Mode 01.');
  }

  const definicion = obtenerDefinicionPidMode01(comando);
  if (!definicion) {
    throw new Error(`${comando} no forma parte del catalogo Mode 01.`);
  }

  const compatibles = new Set(
    opciones.pidsCompatibles.map(pid => pid.trim().toUpperCase()),
  );
  const compatible = compatibles.has(comando);
  const valor = opciones.resultado.datoTraducido;
  const valorValido = esValorLectura(valor);

  return {
    casoId: opciones.casoId,
    pid: comando,
    nombre: definicion.nombre,
    valor: valorValido ? copiarValor(valor) : null,
    unidad: opciones.resultado.unidad,
    fecha: opciones.resultado.fecha,
    origen: opciones.origen,
    compatible,
    valida:
      compatible &&
      valorValido &&
      opciones.resultado.erroresComunicacion.length === 0,
  };
}

function esValorLectura(
  valor: ResultadoJsonObd['datoTraducido'],
): valor is ValorLecturaChatbot {
  if (valor === null) return false;
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor === 'string') return valor.trim().length > 0;
  if (Array.isArray(valor)) {
    return (
      valor.length > 0 && valor.every(elemento => typeof elemento === 'string')
    );
  }
  return Object.keys(valor).length > 0;
}

function copiarValor(valor: ValorLecturaChatbot): ValorLecturaChatbot {
  if (Array.isArray(valor)) return [...valor];
  if (typeof valor === 'object') return { ...valor };
  return valor;
}
