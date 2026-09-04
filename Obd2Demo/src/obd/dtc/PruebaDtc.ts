import type {
  InformacionCaracteristicaGatt,
  InformacionDispositivoBle,
  RespuestaElm,
} from '../../tipos/ble';
import { ErrorCapturaElm } from '../ServicioElm327';
import {
  CATEGORIAS_DTC,
  esComandoDtc,
  interpretarDtc,
  numeroProtocolo,
  type ComandoDtc,
  type ContextoDtc,
  type EstadoDtc,
  type ResultadoDtc,
} from './InterpretarDtc';

export const VERSION_PRUEBA_DTC = 'lector-dtc-2026-09-03-v2';

export interface CapturaPruebaDtc {
  numero: number;
  fase: string;
  comando: string;
  fecha: string;
  contexto: ContextoDtc;
  respuesta: RespuestaElm | null;
  error: string | null;
  resultadoDtc: ResultadoDtc | null;
}

export interface ResumenLecturaDtc {
  cantidadCodigosUnicos: number;
  codigosUnicos: string[];
  categorias: Record<ComandoDtc, ResultadoDtc | null>;
}

interface CategoriaDtcVisible {
  estado: EstadoDtc | 'no-consultado';
  codigos: string[];
  ecu: Array<{
    identificador: string | null;
    estado: EstadoDtc;
    codigos: string[];
  }>;
}

export interface ResultadoJsonDtc {
  fecha: string;
  dispositivo: {
    nombre: string | null;
    identificador: string;
  };
  comando: '03 -> 07 -> 0A';
  respuestaCruda: null;
  datoTraducido: {
    cantidadCodigosUnicos: number;
    codigosUnicos: string[];
    confirmados: CategoriaDtcVisible;
    pendientes: CategoriaDtcVisible;
    permanentes: CategoriaDtcVisible;
  };
  unidad: 'DTC';
  erroresComunicacion: string[];
}

export interface InformePruebaDtc {
  versionEsquema: 2;
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
  resumen: ResumenLecturaDtc;
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

export function construirResumenDtc(
  capturas: CapturaPruebaDtc[],
): ResumenLecturaDtc {
  const categorias: ResumenLecturaDtc['categorias'] = {
    '03': null,
    '07': null,
    '0A': null,
  };
  for (const captura of capturas) {
    if (esComandoDtc(captura.comando) && captura.resultadoDtc) {
      categorias[captura.comando] = captura.resultadoDtc;
    }
  }
  const codigosUnicos = [
    ...new Set(
      Object.values(categorias).flatMap(resultado => resultado?.codigos ?? []),
    ),
  ];
  return {
    cantidadCodigosUnicos: codigosUnicos.length,
    codigosUnicos,
    categorias,
  };
}

/** Produce el JSON breve de interfaz; las respuestas completas quedan en capturas. */
export function construirResultadoJsonDtc(
  informe: InformePruebaDtc,
): ResultadoJsonDtc {
  const simplificar = (resultado: ResultadoDtc | null): CategoriaDtcVisible => ({
    estado: resultado?.estado ?? 'no-consultado',
    codigos: resultado?.codigos ?? [],
    ecu:
      resultado?.mensajes.map(mensaje => ({
        identificador: mensaje.ecu,
        estado: mensaje.estado,
        codigos: mensaje.codigos,
      })) ?? [],
  });
  const errores = informe.capturas.flatMap(captura =>
    captura.error ? [`${captura.comando}: ${captura.error}`] : [],
  );
  for (const resultado of Object.values(informe.resumen.categorias)) {
    if (resultado) {
      errores.push(...resultado.advertencias);
    }
  }
  if (informe.estado !== 'completada' && informe.estado !== 'en-curso') {
    errores.unshift(`Lectura ${informe.estado}; revisar inspeccion cruda.`);
  }
  return {
    fecha: informe.fin ?? informe.inicio,
    dispositivo: {
      nombre: informe.dispositivo.nombre,
      identificador: informe.dispositivo.id,
    },
    comando: '03 -> 07 -> 0A',
    // Es una operacion compuesta: la evidencia cruda vive por captura.
    respuestaCruda: null,
    datoTraducido: {
      cantidadCodigosUnicos: informe.resumen.cantidadCodigosUnicos,
      codigosUnicos: informe.resumen.codigosUnicos,
      confirmados: simplificar(informe.resumen.categorias['03']),
      pendientes: simplificar(informe.resumen.categorias['07']),
      permanentes: simplificar(informe.resumen.categorias['0A']),
    },
    unidad: 'DTC',
    erroresComunicacion: [...new Set(errores)],
  };
}

/** Copia JSON evita que React o un guardado diferido observen un array mutable. */
function instantanea(informe: InformePruebaDtc): InformePruebaDtc {
  return JSON.parse(JSON.stringify(informe)) as InformePruebaDtc;
}

/** Lee las tres categorias DTC genericas. Nunca envia 04 ni controla actuadores. */
export async function ejecutarPruebaDtc(
  opciones: OpcionesPruebaDtc,
): Promise<InformePruebaDtc> {
  const informe: InformePruebaDtc = {
    versionEsquema: 2,
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
      '03, 07 y 0A son categorias independientes: confirmados, pendientes y permanentes.',
      'NO DATA no se presenta como una lista vacia ni como ausencia confirmada de DTC.',
      'No se consulta VIN. Revisar identificador BLE y notas antes de compartir.',
      'La lectura termina intentando ATH0. Otros ajustes quedan en E0/L0/S1/CAF1.',
    ],
    resumen: construirResumenDtc([]),
    capturas: [],
  };
  const contexto: ContextoDtc = { protocolo: null, cabeceras: null };
  let detener = false;
  let huboError = false;
  let falloGuardadoAvisado = false;
  let formatoPreparado = false;

  async function publicar(mensaje: string) {
    informe.resumen = construirResumenDtc(informe.capturas);
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
      resultadoDtc: null,
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
      captura.resultadoDtc = interpretarDtc(
        comando,
        captura.respuesta.textoAscii,
        captura.contexto,
      );
    }
    informe.capturas.push(captura);
    await publicar(`${fase}: ${comando} registrado`);
    return captura;
  }

  async function ajustar(
    comando: string,
    opcionesAjuste: { limpieza?: boolean; opcional?: boolean } = {},
  ): Promise<boolean> {
    const captura = await consultar(
      comando,
      opcionesAjuste.limpieza ? 'restauracion' : 'configuracion',
      opcionesAjuste.limpieza,
    );
    const ok = Boolean(
      captura &&
        !captura.error &&
        /(?:^|[\r\n])\s*OK\s*(?:[\r\n>]|$)/i.test(
          captura.respuesta?.textoAscii ?? '',
        ),
    );
    if (!ok && captura) {
      if (!opcionesAjuste.opcional) {
        huboError = true;
      }
      informe.advertencias.push(
        opcionesAjuste.opcional
          ? `${comando} no confirmo OK; se usara el formato alternativo.`
          : `${comando} no confirmo OK; no asumir ese ajuste.`,
      );
    }
    return ok;
  }

  await publicar('Preparando lectura DTC');
  try {
    await consultar('ATI', 'identificacion');
    // No ATZ ni ATSP: conserva el protocolo elegido, sin reiniciarlo.
    for (const comando of ['ATE0', 'ATL0', 'ATS1']) {
      await ajustar(comando);
    }
    formatoPreparado = await ajustar('ATCAF1');
    const sinCabeceras = await ajustar('ATH0');
    contexto.cabeceras = sinCabeceras ? false : null;
    if (!sinCabeceras || !formatoPreparado) {
      detener = true;
      informe.advertencias.push(
        'Formato no confirmado; se detuvo para no atribuir bytes inciertos a un DTC.',
      );
    }

    // Esta consulta activa la deteccion automatica del protocolo en ELM327.
    await consultar('0101', 'deteccion-protocolo');
    await consultar('ATDP', 'protocolo');
    const protocolo = await consultar('ATDPN', 'protocolo');
    contexto.protocolo = protocolo?.error
      ? null
      : protocolo?.respuesta?.textoAscii ?? null;
    if (numeroProtocolo(contexto.protocolo) === null) {
      huboError = true;
      informe.advertencias.push(
        'No se pudo confirmar el protocolo. Las respuestas se conservan sin adivinar DTC.',
      );
    }

    // Se prefieren cabeceras porque identifican ECU y evitan confundir PCI/DLC con DTC.
    const usaCabeceras = await ajustar('ATH1', { opcional: true });
    if (usaCabeceras) {
      contexto.cabeceras = true;
    } else {
      const restaurado = await ajustar('ATH0');
      contexto.cabeceras = restaurado ? false : null;
      if (!restaurado) {
        detener = true;
      }
    }
    if (!detener) {
      await consultar('0101', 'estado-general');
      for (const comando of Object.keys(CATEGORIAS_DTC) as ComandoDtc[]) {
        await consultar(comando, 'lectura-dtc');
      }
    }
  } catch (error) {
    huboError = true;
    detener = true;
    informe.advertencias.push(
      `Fallo de la lectura: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    if (opciones.conectado() && opciones.sincronizado()) {
      await ajustar('ATH0', { limpieza: true });
    } else {
      huboError = true;
      informe.advertencias.push(
        'No se pudo restaurar ATH0. Reconectar e inicializar antes de nuevas lecturas.',
      );
    }
    if (!opciones.sincronizado()) {
      informe.advertencias.push(
        'Falto el prompt final. Se detuvo para no cruzar una respuesta tardia.',
      );
    }
    informe.resumen = construirResumenDtc(informe.capturas);
    const categoriasLeidas = Object.values(informe.resumen.categorias).filter(
      Boolean,
    ).length;
    informe.estado = opciones.cancelado()
      ? 'cancelada'
      : detener || huboError || categoriasLeidas !== 3
      ? 'parcial'
      : 'completada';
    informe.fin = new Date().toISOString();
    await publicar(
      `Lectura ${informe.estado}. Puedes guardar el informe JSON.`,
    );
  }
  return instantanea(informe);
}

export function nombreInformeDtc(informe: InformePruebaDtc): string {
  return `SmartOBD_DTC_${informe.inicio.replace(/[:.]/g, '-')}.json`;
}
