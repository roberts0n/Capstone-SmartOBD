import type { SesionTaller } from '../tipos/usuarioTaller';
import type { ValorJson } from './TiposSnapshotDiagnostico';
import type {
  FalloCapturaSnapshot,
  OpcionesCapturaSnapshot,
  ProgresoCapturaSnapshot,
  ResultadoCapturaGuardada,
  ResultadoCapturaSnapshot,
} from './TiposCapturaSnapshot';
import type {
  MotivoSnapshotParcial,
  NuevoCodigoDtcSnapshot,
  NuevoValorPidSnapshot,
} from './TiposSnapshotDiagnostico';
import {
  ejecutarDeteccionPids,
  type ResultadoEjecucionDeteccionPids,
} from '../obd/EjecutarDeteccionPids';
import { traducirPidMode01 } from '../obd/CatalogoPidsMode01';
import {
  ejecutarPruebaDtc,
  type InformePruebaDtc,
} from '../obd/dtc/PruebaDtc';
import type { ComandoDtc, ResultadoDtc } from '../obd/dtc/InterpretarDtc';
import { guardarSnapshotDiagnostico } from './ServicioSnapshotsDiagnostico';

export async function capturarSnapshotDiagnostico(
  opciones: OpcionesCapturaSnapshot,
): Promise<ResultadoCapturaSnapshot> {
  const fallos: FalloCapturaSnapshot[] = [];
  const valoresPid: NuevoValorPidSnapshot[] = [];
  const pidsLeidos: string[] = [];
  let resultadoDeteccion: ResultadoEjecucionDeteccionPids | null = null;
  let informeDtc: InformePruebaDtc | null = null;

  informar(opciones, {
    etapa: 'detectando-pids',
    actual: null,
    total: null,
    mensaje: 'Detectando los PID compatibles del vehiculo.',
  });

  try {
    resultadoDeteccion = await ejecutarDeteccionPids({
      enviar: opciones.enviar,
      conectado: opciones.conectado,
      sincronizado: opciones.sincronizado,
      cancelado: opciones.cancelado,
      alProgresar: progreso =>
        informar(opciones, {
          etapa: 'detectando-pids',
          actual: null,
          total: null,
          mensaje: progreso.mensaje,
        }),
    });
  } catch (capturado) {
    fallos.push({
      etapa: 'deteccion-pids',
      comando: null,
      mensaje: mensajeError(capturado),
    });
  }

  if (resultadoDeteccion && disponible(opciones)) {
    const pids = resultadoDeteccion.deteccion.pidsInterpretables;
    for (let indice = 0; indice < pids.length; indice += 1) {
      const pid = pids[indice];
      if (!disponible(opciones)) {
        break;
      }

      informar(opciones, {
        etapa: 'leyendo-pids',
        actual: indice + 1,
        total: pids.length,
        mensaje: `Leyendo ${pid} (${indice + 1} de ${pids.length}).`,
      });

      try {
        // Algunos PID de configuracion ya fueron consultados durante la
        // deteccion. Reusar esa respuesta evita enviar el mismo comando dos veces.
        const respuestaConfiguracion =
          resultadoDeteccion.respuestasConfiguracion[pid];
        const respuestaCruda = respuestaConfiguracion
          ? respuestaConfiguracion
          : (await opciones.enviar(pid)).textoAscii;
        const traduccion = traducirPidMode01(
          pid,
          respuestaCruda,
          resultadoDeteccion.contextoMode01,
        );
        const valor = convertirAValorJson(traduccion?.valor);
        if (!traduccion || traduccion.error || valor === null) {
          throw new Error(
            traduccion?.error ?? `El PID ${pid} no entrego un valor util.`,
          );
        }
        valoresPid.push({ pidCodigo: pid, valor });
        pidsLeidos.push(pid);
      } catch (capturado) {
        fallos.push({
          etapa: 'lectura-pid',
          comando: pid,
          mensaje: mensajeError(capturado),
        });
        // Un prompt pendiente puede terminar dentro de la proxima respuesta.
        // En ese caso se detiene en vez de asociar datos al PID equivocado.
        if (!opciones.conectado() || !opciones.sincronizado()) {
          break;
        }
      }
    }
  }

  if (valoresPid.length === 0) {
    fallos.push({
      etapa: 'lectura-pid',
      comando: null,
      mensaje: 'No se obtuvo ningun valor PID interpretable.',
    });
  }

  if (disponible(opciones)) {
    informar(opciones, {
      etapa: 'leyendo-dtc',
      actual: 0,
      total: 3,
      mensaje: 'Preparando lectura de DTC confirmados, pendientes y permanentes.',
    });
    try {
      informeDtc = await ejecutarPruebaDtc({
        dispositivo: opciones.dispositivo,
        escritura: opciones.escritura,
        notificacion: opciones.notificacion,
        versionAplicacion: opciones.versionAplicacion,
        condiciones: `Snapshot ${opciones.tipo} del caso ${opciones.casoId}.`,
        enviar: opciones.enviar,
        conectado: opciones.conectado,
        sincronizado: opciones.sincronizado,
        cancelado: opciones.cancelado,
        guardarAvance: async () => undefined,
        alProgresar: (_informe, mensaje) =>
          informar(opciones, {
            etapa: 'leyendo-dtc',
            actual: null,
            total: 3,
            mensaje,
          }),
      });
      if (!lecturaDtcEsCompleta(informeDtc)) {
        fallos.push({
          etapa: 'lectura-dtc',
          comando: null,
          mensaje:
            informeDtc.estado === 'completada'
              ? 'La lectura DTC contiene una categoria que no pudo interpretarse con certeza.'
              : `La lectura DTC termino como ${informeDtc.estado}.`,
        });
      }
    } catch (capturado) {
      fallos.push({
        etapa: 'lectura-dtc',
        comando: null,
        mensaje: mensajeError(capturado),
      });
    }
  }

  informar(opciones, {
    etapa: 'preparando-snapshot',
    actual: null,
    total: null,
    mensaje: 'Preparando el snapshot de diagnostico.',
  });

  const motivoParcial = resolverMotivoParcial(opciones, fallos);
  return {
    snapshot: {
      casoId: opciones.casoId.trim(),
      tipo: opciones.tipo,
      estado: motivoParcial ? 'parcial' : 'completo',
      motivoParcial,
      valoresPid,
      codigosDtc: extraerCodigosDtc(informeDtc),
    },
    cancelada: opciones.cancelado(),
    deteccion: resultadoDeteccion?.deteccion ?? null,
    pidsLeidos,
    fallos,
    informeDtc,
  };
}

export async function capturarYGuardarSnapshotDiagnostico(
  opciones: OpcionesCapturaSnapshot,
  sesion: SesionTaller,
): Promise<ResultadoCapturaGuardada> {
  validarInicioCapturaSnapshot(opciones, sesion);
  const captura = await capturarSnapshotDiagnostico(opciones);
  if (captura.cancelada) {
    throw new Error('La captura fue cancelada y no se guardo el snapshot.');
  }

  informar(opciones, {
    etapa: 'guardando',
    actual: null,
    total: null,
    mensaje: 'Guardando el snapshot en el caso de diagnostico.',
  });
  const snapshotGuardado = await guardarSnapshotDiagnostico(
    captura.snapshot,
    sesion,
  );
  return { captura, snapshotGuardado };
}

function extraerCodigosDtc(
  informe: InformePruebaDtc | null,
): NuevoCodigoDtcSnapshot[] {
  if (!informe) {
    return [];
  }

  const codigos = new Map<string, NuevoCodigoDtcSnapshot>();
  for (const [modo, resultado] of Object.entries(
    informe.resumen.categorias,
  ) as Array<[ComandoDtc, ResultadoDtc | null]>) {
    if (!resultado) {
      continue;
    }

    const asociadosAEcu = new Set<string>();
    for (const mensaje of resultado.mensajes) {
      for (const codigo of mensaje.codigos) {
        asociadosAEcu.add(codigo);
        agregarCodigoDtc(codigos, {
          codigo,
          modoObd: modo,
          ecu: mensaje.ecu,
        });
      }
    }
    for (const codigo of resultado.codigos) {
      if (!asociadosAEcu.has(codigo)) {
        agregarCodigoDtc(codigos, { codigo, modoObd: modo, ecu: null });
      }
    }
  }
  return [...codigos.values()];
}

function lecturaDtcEsCompleta(informe: InformePruebaDtc): boolean {
  if (informe.estado !== 'completada') {
    return false;
  }
  const estadosInciertos = new Set([
    'parcial',
    'invalida',
    'protocolo-desconocido',
  ]);
  return Object.values(informe.resumen.categorias).every(
    resultado => resultado !== null && !estadosInciertos.has(resultado.estado),
  );
}

function agregarCodigoDtc(
  codigos: Map<string, NuevoCodigoDtcSnapshot>,
  entrada: NuevoCodigoDtcSnapshot,
): void {
  const codigo = entrada.codigo.trim().toUpperCase();
  const ecu = entrada.ecu?.replace(/\s+/g, '').toUpperCase() || null;
  const clave = `${codigo}:${entrada.modoObd}:${ecu ?? ''}`;
  codigos.set(clave, {
    codigo,
    modoObd: entrada.modoObd,
    ecu,
  });
}

function resolverMotivoParcial(
  opciones: OpcionesCapturaSnapshot,
  fallos: FalloCapturaSnapshot[],
): MotivoSnapshotParcial | null {
  if (!opciones.conectado() || !opciones.sincronizado()) {
    return 'conexion_interrumpida';
  }
  if (opciones.motivoParcialInicial) {
    return opciones.motivoParcialInicial;
  }
  if (opciones.cancelado() || fallos.length > 0) {
    return 'lecturas_incompletas';
  }
  return null;
}

function convertirAValorJson(valor: unknown): ValorJson | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  try {
    const serializado = JSON.stringify(valor);
    return serializado === undefined
      ? null
      : (JSON.parse(serializado) as ValorJson);
  } catch {
    return null;
  }
}

function disponible(opciones: OpcionesCapturaSnapshot): boolean {
  return (
    !opciones.cancelado() &&
    opciones.conectado() &&
    opciones.sincronizado()
  );
}

function informar(
  opciones: OpcionesCapturaSnapshot,
  progreso: ProgresoCapturaSnapshot,
): void {
  opciones.alProgresar?.(progreso);
}

export function validarInicioCapturaSnapshot(
  opciones: Pick<OpcionesCapturaSnapshot, 'casoId' | 'tipo'>,
  sesion: SesionTaller,
): void {
  if (!opciones.casoId.trim()) {
    throw new Error('Selecciona un caso antes de capturar el snapshot.');
  }
  const recepcionValida =
    sesion.perfil === 'recepcion' && opciones.tipo === 'ingreso';
  const mecanicoValido =
    sesion.perfil === 'mecanico' && opciones.tipo !== 'ingreso';
  if (!recepcionValida && !mecanicoValido) {
    throw new Error(
      'El rol actual no puede realizar este tipo de snapshot de diagnostico.',
    );
  }
}

function mensajeError(capturado: unknown): string {
  return capturado instanceof Error ? capturado.message : String(capturado);
}
