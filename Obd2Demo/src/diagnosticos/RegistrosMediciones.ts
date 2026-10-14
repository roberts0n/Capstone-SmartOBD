import { supabase } from '../servicios/clienteSupabase';
import { obtenerMedicionGraficaPid } from '../obd/CatalogoPidsMode01';
import type { RegistroHistoricoPids } from '../obd/RegistroHistoricoPids';
import type { SesionTaller } from '../tipos/usuarioTaller';

export const LIMITES_REGISTRO_MEDICIONES = {
  series: 3,
  muestrasPorSerie: 2400,
  duracionSolicitadaMs: 600000,
  // dejo margen para que termine el ultimo comando, no para alargar la captura
  duracionRealMs: 660000,
  bytesSeries: 1500000,
} as const;

export interface PuntoMedicionGuardado {
  tiempoMs: number;
  valor: number | null;
}

export interface SerieMedicionGuardada {
  pidCodigo: string;
  nombre: string;
  unidad: string;
  campo: string | null;
  ecu: string | null;
  estado: 'disponible' | 'sin-lectura';
  muestras: PuntoMedicionGuardado[];
}

export interface NuevoRegistroMediciones {
  casoId: string;
  titulo: string | null;
  inicio: string;
  duracionSolicitadaMs: number;
  duracionRealMs: number;
  estado: 'completo' | 'parcial';
  motivoFin: string;
  series: SerieMedicionGuardada[];
}

export interface ResumenRegistroMediciones
  extends Omit<NuevoRegistroMediciones, 'series'> {
  id: string;
  tallerId: string;
  guardadoPor: string;
}

export interface RegistroMediciones extends ResumenRegistroMediciones {
  series: SerieMedicionGuardada[];
}

interface FilaRegistroMediciones {
  id: string;
  caso_id: string;
  taller_id: string;
  guardado_por: string;
  titulo: string | null;
  inicio: string;
  duracion_solicitada_ms: number;
  duracion_real_ms: number;
  estado: 'completo' | 'parcial';
  motivo_fin: string;
  series?: SerieMedicionGuardada[];
}

const CAMPOS_RESUMEN =
  'id,caso_id,taller_id,guardado_por,titulo,inicio,duracion_solicitada_ms,duracion_real_ms,estado,motivo_fin';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function prepararRegistroMediciones(
  casoId: string,
  registro: RegistroHistoricoPids,
  titulo?: string | null,
): NuevoRegistroMediciones {
  if (!registro.inicio || !registro.fin)
    throw new Error('Termina el registro antes de guardarlo.');
  // tomo solo lo que permite reconstruir el grafico; dejo fuera consola, bytes y metricas tecnicas
  return normalizarRegistro({
    casoId,
    titulo: titulo ?? null,
    inicio: registro.inicio,
    duracionSolicitadaMs: registro.duracionSolicitadaMs,
    duracionRealMs: registro.duracionRealMs,
    estado: registro.estado,
    motivoFin: registro.motivoFin,
    series: registro.series.map(serie => ({
      pidCodigo: serie.comando,
      nombre: serie.nombre,
      unidad: serie.unidad,
      campo: serie.campo ?? null,
      ecu: serie.seleccionOrigen?.cabecera ?? null,
      estado: serie.estado,
      muestras: serie.muestras.map(muestra => ({
        tiempoMs: muestra.tiempoTranscurridoMs,
        valor: muestra.valor,
      })),
    })),
  });
}

export async function guardarRegistroMediciones(
  entrada: NuevoRegistroMediciones,
  sesion: SesionTaller,
): Promise<string> {
  validarSesion(sesion);
  const registro = normalizarRegistro(entrada);
  const { data, error } = await supabase.rpc('guardar_registro_mediciones', {
    caso_objetivo: registro.casoId,
    inicio_registro: registro.inicio,
    duracion_solicitada: registro.duracionSolicitadaMs,
    duracion_real: registro.duracionRealMs,
    estado_registro: registro.estado,
    motivo_finalizacion: registro.motivoFin,
    series_registro: registro.series,
    titulo_registro: registro.titulo,
  });
  if (error) throw new Error(mensajeError(error));
  if (typeof data !== 'string' || !UUID.test(data))
    throw new Error(
      'No se pudo confirmar el guardado. Reintenta la misma captura, sin iniciar otra.',
    );
  // devuelvo el id confirmado sin agregar una consulta que pueda confundir un fallo de recarga con uno de guardado
  return data;
}

export async function listarRegistrosMediciones(
  casoId: string,
  sesion: SesionTaller,
  opciones: { desde?: number; limite?: number } = {},
): Promise<ResumenRegistroMediciones[]> {
  validarSesion(sesion);
  const caso = identificador(casoId);
  const desde = opciones.desde ?? 0;
  const limite = opciones.limite ?? 21;
  if (
    !Number.isSafeInteger(desde) ||
    desde < 0 ||
    !Number.isInteger(limite) ||
    limite < 1 ||
    limite > 100 ||
    !Number.isSafeInteger(desde + limite)
  )
    throw new Error('La consulta de registros no es válida.');
  const { data, error } = await supabase
    .from('registros_mediciones')
    .select(CAMPOS_RESUMEN)
    .eq('caso_id', caso)
    .eq('taller_id', sesion.tallerId)
    .order('inicio', { ascending: false })
    .order('id', { ascending: false })
    .range(desde, desde + limite - 1);
  if (error) throw new Error(mensajeError(error));
  return ((data ?? []) as FilaRegistroMediciones[]).map(convertirResumen);
}

export async function obtenerRegistroMediciones(
  registroId: string,
  casoId: string,
  sesion: SesionTaller,
): Promise<RegistroMediciones | null> {
  validarSesion(sesion);
  const id = identificador(registroId);
  const caso = identificador(casoId);
  const { data, error } = await supabase
    .from('registros_mediciones')
    .select(`${CAMPOS_RESUMEN},series`)
    .eq('id', id)
    .eq('caso_id', caso)
    .eq('taller_id', sesion.tallerId)
    .maybeSingle();
  if (error) throw new Error(mensajeError(error));
  if (!data) return null;
  const fila = data as FilaRegistroMediciones;
  const resumen = convertirResumen(fila);
  // una curva antigua conserva su nombre, campo y unidad aunque despues ampliemos el catalogo
  const registro = normalizarRegistro(
    { ...resumen, series: fila.series! },
    false,
  );
  return { ...resumen, ...registro };
}

function validarSesion(sesion: SesionTaller) {
  if (
    sesion.perfil !== 'mecanico' ||
    sesion.debeCambiarPassword ||
    !UUID.test(sesion.usuarioId) ||
    !UUID.test(sesion.tallerId)
  )
    throw new Error('Se necesita una sesión de mecánico habilitada.');
}

function identificador(valor: string): string {
  if (typeof valor !== 'string' || !UUID.test(valor.trim()))
    throw new Error('El identificador del registro o del caso no es válido.');
  return valor.trim().toLowerCase();
}

function cadena(valor: unknown, maximo: number): string {
  if (
    typeof valor !== 'string' ||
    !valor.trim() ||
    valor.trim().length > maximo
  )
    throw new Error('Uno de los textos del registro no es válido.');
  return valor.trim();
}

function normalizarRegistro(
  entrada: NuevoRegistroMediciones,
  revisarCatalogo = true,
): NuevoRegistroMediciones {
  const casoId = identificador(entrada.casoId);
  const inicioMs =
    typeof entrada.inicio === 'string' ? Date.parse(entrada.inicio) : NaN;
  if (!Number.isFinite(inicioMs))
    throw new Error('La fecha de inicio del registro no es válida.');
  const solicitada = entrada.duracionSolicitadaMs;
  const real = entrada.duracionRealMs;
  if (
    !Number.isFinite(solicitada) ||
    solicitada < 1000 ||
    solicitada > LIMITES_REGISTRO_MEDICIONES.duracionSolicitadaMs ||
    !Number.isFinite(real) ||
    real <= 0 ||
    real > LIMITES_REGISTRO_MEDICIONES.duracionRealMs
  )
    throw new Error(
      'La duración del registro está fuera del límite permitido.',
    );
  if (
    !['completo', 'parcial'].includes(entrada.estado) ||
    (entrada.estado === 'completo' && real < solicitada)
  )
    throw new Error('El estado del registro no coincide con su duración.');
  if (
    !Array.isArray(entrada.series) ||
    entrada.series.length < 1 ||
    entrada.series.length > LIMITES_REGISTRO_MEDICIONES.series
  )
    throw new Error('El registro debe contener entre una y tres series.');
  const pids = new Set<string>();
  let totalValidas = 0;
  const series = entrada.series.map(serie => {
    const pidCodigo = cadena(serie.pidCodigo, 4).toUpperCase();
    const nombre = cadena(serie.nombre, 160);
    const unidad = cadena(serie.unidad, 24);
    const campo = serie.campo === null ? null : cadena(serie.campo, 80);
    const ecu = serie.ecu === null ? null : cadena(serie.ecu, 8).toUpperCase();
    const medicion = obtenerMedicionGraficaPid(pidCodigo);
    if (
      !/^01[0-9A-F]{2}$/.test(pidCodigo) ||
      pids.has(pidCodigo) ||
      (revisarCatalogo &&
        (!medicion || medicion.unidad !== unidad || medicion.campo !== campo))
    )
      throw new Error(
        'El PID está repetido o no coincide con una medición gráfica compatible.',
      );
    if (ecu !== null && !/^[0-9A-F]{2,8}$/.test(ecu))
      throw new Error('El origen ECU no es válido.');
    if (!['disponible', 'sin-lectura'].includes(serie.estado))
      throw new Error('El estado de una serie no es válido.');
    pids.add(pidCodigo);
    if (
      !Array.isArray(serie.muestras) ||
      serie.muestras.length > LIMITES_REGISTRO_MEDICIONES.muestrasPorSerie
    )
      throw new Error('La cantidad de muestras supera el límite permitido.');
    let anterior = -1;
    let validas = 0;
    const muestras = serie.muestras.map(muestra => {
      if (
        !Number.isFinite(muestra.tiempoMs) ||
        muestra.tiempoMs < 0 ||
        muestra.tiempoMs > real ||
        muestra.tiempoMs < anterior
      )
        throw new Error('Los tiempos de las muestras no son válidos.');
      if (
        muestra.valor !== null &&
        (typeof muestra.valor !== 'number' || !Number.isFinite(muestra.valor))
      )
        throw new Error('Una muestra contiene un valor no válido.');
      anterior = muestra.tiempoMs;
      if (muestra.valor !== null) validas += 1;
      return { tiempoMs: muestra.tiempoMs, valor: muestra.valor };
    });
    if (
      entrada.estado === 'completo' &&
      (validas === 0 || serie.estado !== 'disponible')
    )
      throw new Error(
        'Un registro completo requiere lecturas válidas en cada serie.',
      );
    totalValidas += validas;
    return {
      pidCodigo,
      nombre,
      unidad,
      campo,
      ecu,
      estado: serie.estado,
      muestras,
    };
  });
  if (totalValidas === 0)
    throw new Error('No hay mediciones válidas para guardar.');
  let bytes = 0;
  for (const caracter of JSON.stringify(series)) {
    const codigo = caracter.codePointAt(0)!;
    bytes +=
      codigo <= 0x7f ? 1 : codigo <= 0x7ff ? 2 : codigo <= 0xffff ? 3 : 4;
  }
  if (bytes > LIMITES_REGISTRO_MEDICIONES.bytesSeries)
    throw new Error('El registro supera el tamaño permitido.');
  return {
    casoId,
    titulo:
      entrada.titulo === null ||
      (typeof entrada.titulo === 'string' && !entrada.titulo.trim())
        ? null
        : cadena(entrada.titulo, 100),
    inicio: new Date(inicioMs).toISOString(),
    duracionSolicitadaMs: solicitada,
    duracionRealMs: real,
    estado: entrada.estado,
    motivoFin: cadena(entrada.motivoFin, 300),
    series,
  };
}

function convertirResumen(
  fila: FilaRegistroMediciones,
): ResumenRegistroMediciones {
  return {
    id: fila.id,
    casoId: fila.caso_id,
    tallerId: fila.taller_id,
    guardadoPor: fila.guardado_por,
    titulo: fila.titulo,
    inicio: fila.inicio,
    duracionSolicitadaMs: fila.duracion_solicitada_ms,
    duracionRealMs: fila.duracion_real_ms,
    estado: fila.estado,
    motivoFin: fila.motivo_fin,
  };
}

function mensajeError(error: { code?: string; message?: string }): string {
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code ?? ''))
    return 'Falta actualizar la base de datos para guardar y consultar históricos.';
  if (error.message?.includes('otros datos'))
    return 'Esta captura ya fue guardada con otros datos. No se reemplazó el registro existente.';
  if (error.message?.includes('en revision'))
    return 'El caso debe estar en revisión para guardar mediciones.';
  if (error.code === '42501' || error.message?.includes('mecanico'))
    return 'No tienes permiso para realizar esta operación sobre el caso.';
  return 'No se pudo completar la operación. Si estabas guardando, reintenta la misma captura para evitar duplicados.';
}
