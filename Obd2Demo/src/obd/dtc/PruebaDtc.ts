import type {
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
  RespuestaElm,
} from '../../tipos/ble';
import { ErrorCapturaElm } from '../ServicioElm327';
import { compararDtc, type ComparacionDtc } from './CompararDtc';
import {
  esComandoDtc,
  numeroProtocolo,
  type ContextoDtc,
} from './InterpretarDtc';

export const VERSION_PRUEBA_DTC = 'dtc-lab-2026-09-02-v1';
export interface CapturaPruebaDtc {
  numero: number;
  fase: string;
  comando: string;
  fecha: string;
  contexto: ContextoDtc;
  respuesta: RespuestaElm | null;
  error: string | null;
  comparacion: ComparacionDtc | null;
}
export interface InformePruebaDtc {
  versionEsquema: 1;
  versionPrueba: string;
  versionAplicacion: string;
  inicio: string;
  fin: string | null;
  estado: 'en-curso' | 'completada' | 'parcial' | 'cancelada' | 'interrumpida';
  dispositivo: Pick<InformacionDispositivoBle, 'id' | 'nombre'>;
  canales: {
    escritura: InformacionCaracteristicaGatt;
    notificacion: InformacionCaracteristicaGatt;
  };
  condiciones: string;
  advertencias: string[];
  capturas: CapturaPruebaDtc[];
}
export interface OpcionesPruebaDtc {
  dispositivo: InformacionDispositivoBle;
  escritura: InformacionCaracteristicaGatt;
  notificacion: InformacionCaracteristicaGatt;
  versionAplicacion: string;
  condiciones: string;
  enviar: (comando: string) => Promise<RespuestaElm>;
  conectado: () => boolean;
  sincronizado: () => boolean;
  cancelado: () => boolean;
  guardarAvance: (informe: InformePruebaDtc) => Promise<void>;
  alProgresar: (informe: InformePruebaDtc, mensaje: string) => void;
}

/** Copia JSON evita que React o un guardado diferido observen un array mutable. */
function instantanea(informe: InformePruebaDtc): InformePruebaDtc {
  return JSON.parse(JSON.stringify(informe)) as InformePruebaDtc;
}

/** Lote acotado de solo lectura vehicular. Nunca envia 04 ni controles de actuadores. */
export async function ejecutarPruebaDtc(
  opciones: OpcionesPruebaDtc,
): Promise<InformePruebaDtc> {
  const informe: InformePruebaDtc = {
    versionEsquema: 1,
    versionPrueba: VERSION_PRUEBA_DTC,
    versionAplicacion: opciones.versionAplicacion,
    inicio: new Date().toISOString(),
    fin: null,
    estado: 'en-curso',
    dispositivo: {
      id: opciones.dispositivo.id,
      nombre: opciones.dispositivo.nombre,
    },
    canales: {
      escritura: opciones.escritura,
      notificacion: opciones.notificacion,
    },
    condiciones: opciones.condiciones,
    advertencias: [
      'Original y por lineas son referencias historicas, no diagnosticos.',
      'No se consulta VIN. El informe contiene identificador BLE y notas ingresadas; revisar antes de compartir.',
      'La prueba termina intentando ATH0. Otros ajustes de formato quedan en E0/L0/S1/CAF1.',
    ],
    capturas: [],
  };
  const contexto: ContextoDtc = { protocolo: null, cabeceras: null };
  let detener = false;
  let huboError = false;
  let falloGuardadoAvisado = false;
  let formatoPreparado = false;

  async function publicar(mensaje: string) {
    const copia = instantanea(informe);
    opciones.alProgresar(copia, mensaje);
    try {
      await opciones.guardarAvance(copia);
    } catch {
      if (!falloGuardadoAvisado) {
        informe.advertencias.push(
          'No se pudo guardar el borrador local. Exportar JSON antes de cerrar la app.',
        );
        falloGuardadoAvisado = true;
      }
      opciones.alProgresar(
        instantanea(informe),
        'Error al guardar el borrador. La captura sigue en memoria.',
      );
    }
  }

  async function consultar(comando: string, fase: string, limpieza = false) {
    if (
      (!limpieza && (detener || opciones.cancelado())) ||
      !opciones.conectado() ||
      !opciones.sincronizado()
    ) {
      detener = true;
      return null;
    }
    opciones.alProgresar(instantanea(informe), `${fase}: ${comando}`);
    const captura: CapturaPruebaDtc = {
      numero: informe.capturas.length + 1,
      fase,
      comando,
      fecha: new Date().toISOString(),
      contexto: { ...contexto },
      respuesta: null,
      error: null,
      comparacion: null,
    };
    try {
      captura.respuesta = await opciones.enviar(comando);
    } catch (error) {
      captura.error = error instanceof Error ? error.message : String(error);
      captura.respuesta =
        error instanceof ErrorCapturaElm ? error.captura : null;
      huboError = true;
    }
    if (esComandoDtc(comando) && captura.respuesta) {
      captura.comparacion = compararDtc(
        comando,
        captura.respuesta.textoAscii,
        captura.contexto,
      );
    }
    informe.capturas.push(captura);
    // Guardar evidencia ANTES de decidir continuar: tambien vale la respuesta invalida.
    await publicar(`${fase}: ${comando} registrado`);
    return captura;
  }

  async function ajustar(comando: string, limpieza = false): Promise<boolean> {
    const captura = await consultar(
      comando,
      limpieza ? 'restauracion' : 'configuracion',
      limpieza,
    );
    const ok = Boolean(
      captura &&
        !captura.error &&
        /(?:^|[\r\n])\s*OK\s*(?:[\r\n>]|$)/i.test(
          captura.respuesta?.textoAscii ?? '',
        ),
    );
    if (!ok && captura) {
      huboError = true;
      informe.advertencias.push(
        `${comando} no confirmo OK; no asumir ese ajuste.`,
      );
    }
    return ok;
  }

  await publicar('Preparando prueba DTC');
  try {
    await consultar('ATI', 'identificacion');
    // No ATZ ni ATSP: conserva el protocolo elegido, sin reiniciar innecesariamente.
    for (const comando of ['ATE0', 'ATL0', 'ATS1']) {
      await ajustar(comando);
    }
    formatoPreparado = await ajustar('ATCAF1');
    const sinCabeceras = await ajustar('ATH0');
    contexto.cabeceras = sinCabeceras ? false : null;
    if (!sinCabeceras || !formatoPreparado) {
      detener = true;
      informe.advertencias.push(
        'Formato no confirmado; se detuvo el lote para no enviar OBD con un formato incierto.',
      );
    }
    // 0101 activa la busqueda automatica antes de preguntar que protocolo quedo activo.
    await consultar('0101', 'sin-cabeceras');
    await consultar('ATDP', 'protocolo');
    const protocolo = await consultar('ATDPN', 'protocolo');
    contexto.protocolo = protocolo?.error
      ? null
      : protocolo?.respuesta?.textoAscii ?? null;
    if (numeroProtocolo(contexto.protocolo) === null) {
      informe.advertencias.push(
        'No se pudo confirmar el protocolo. Las capturas se conservan, sin adivinar DTC.',
      );
    }
    for (const comando of ['03', '07', '0A']) {
      await consultar(comando, 'sin-cabeceras');
    }
    if (await ajustar('ATH1')) {
      contexto.cabeceras = true;
      for (const comando of ['0101', '03', '07', '0A']) {
        await consultar(comando, 'con-cabeceras');
      }
    }
  } catch (error) {
    huboError = true;
    detener = true;
    informe.advertencias.push(
      `Fallo del lote: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    if (opciones.conectado() && opciones.sincronizado()) {
      await ajustar('ATH0', true);
    } else {
      huboError = true;
      informe.advertencias.push(
        'No se pudo restaurar ATH0. Reconectar e inicializar antes de nuevas lecturas.',
      );
    }
    if (!opciones.sincronizado()) {
      informe.advertencias.push(
        'Falto el prompt final. Se detuvo para no confundir una respuesta tardia con otra consulta.',
      );
    }
    const dtc = informe.capturas.filter(captura =>
      esComandoDtc(captura.comando),
    );
    informe.estado = opciones.cancelado()
      ? 'cancelada'
      : detener || huboError || dtc.length !== 6
      ? 'parcial'
      : 'completada';
    informe.fin = new Date().toISOString();
    await publicar(`Prueba ${informe.estado}. Puedes guardar el informe JSON.`);
  }
  return instantanea(informe);
}

export function nombreInformeDtc(informe: InformePruebaDtc): string {
  return `SmartOBD_DTC_${informe.inicio.replace(/[:.]/g, '-')}.json`;
}
