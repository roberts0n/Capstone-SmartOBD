import { supabase } from '../servicios/clienteSupabase';
import type { SesionTaller } from '../tipos/usuarioTaller';
import type { CasoDiagnostico } from './TiposCasoDiagnostico';
import {
  CAMPOS_CASO,
  convertirCaso,
  type FilaCasoDiagnostico,
} from './ServicioCasosDiagnostico';

export interface CasoMecanico extends CasoDiagnostico {
  cliente: string;
  vehiculo: string;
  patente: string;
  vin: string | null;
  asignacionId: string;
}

export interface ConsultaCasosMecanico {
  busqueda?: string;
  filtro?: 'pendientes' | 'en_revision' | 'diagnosticados';
  desde?: number;
  limite?: number;
}

interface FilaCasoMecanico extends FilaCasoDiagnostico {
  asignacion: { id: string }[];
  vehiculo: {
    patente: string | null;
    vin: string | null;
    marca: string | null;
    modelo: string | null;
    anio: number | null;
    cliente: { nombre: string };
  };
}

function validarSesion(sesion: SesionTaller) {
  if (
    sesion.perfil !== 'mecanico' ||
    sesion.debeCambiarPassword ||
    !sesion.usuarioId.trim() ||
    !sesion.tallerId.trim()
  )
    throw new Error('Se necesita una sesión de mecánico habilitada.');
}

function consultaDelMecanico(sesion: SesionTaller, buscar = false) {
  validarSesion(sesion);
  // filtro antes de paginar; rls comprueba ademas quien hace realmente la consulta
  return supabase
    .from('casos_diagnosticos')
    .select(
      `${CAMPOS_CASO},asignacion:asignaciones!inner(id),vehiculo:vehiculos!inner(patente,vin,marca,modelo,anio,cliente:clientes!inner(nombre))` +
        (buscar
          ? ',por_patente:vehiculos(id),por_modelo:vehiculos(id),por_marca:vehiculos(id),por_cliente:vehiculos(id,clientes!inner(id))'
          : ''),
    )
    .eq('taller_id', sesion.tallerId)
    .eq('asignacion.mecanico_id', sesion.usuarioId)
    .eq('asignacion.estado', 'activa');
}

export async function listarCasosMecanico(
  sesion: SesionTaller,
  opciones: ConsultaCasosMecanico = {},
): Promise<CasoMecanico[]> {
  const texto = opciones.busqueda?.trim() ?? '';
  const desde = opciones.desde ?? 0;
  const limite = opciones.limite ?? 21;
  const estados = {
    pendientes: 'asignado',
    en_revision: 'en_revision',
    diagnosticados: 'diagnosticado',
  } as const;
  const filtro = opciones.filtro ?? 'pendientes';
  if (
    texto.length > 120 ||
    !Number.isSafeInteger(desde) ||
    desde < 0 ||
    !Number.isInteger(limite) ||
    limite < 1 ||
    limite > 100 ||
    !Number.isSafeInteger(desde + limite) ||
    !Object.prototype.hasOwnProperty.call(estados, filtro)
  )
    throw new Error('La consulta de casos no es válida.');
  let consulta = consultaDelMecanico(sesion, !!texto).eq(
    'estado',
    estados[filtro],
  );
  if (texto) {
    const escapar = (valor: string) =>
      `%${valor.replace(/[\\%_]/g, caracter => `\\${caracter}`)}%`;
    consulta = consulta
      .ilike('por_patente.patente', escapar(texto.replace(/[\s.-]/g, '')))
      .ilike('por_modelo.modelo', escapar(texto))
      .ilike('por_marca.marca', escapar(texto))
      .ilike('por_cliente.clientes.nombre', escapar(texto))
      .or(
        'por_patente.not.is.null,por_modelo.not.is.null,por_marca.not.is.null,por_cliente.not.is.null',
      );
  }
  const { data, error } = await consulta
    .order('creado_en', { ascending: false })
    .order('id', { ascending: false })
    .range(desde, desde + limite - 1);
  if (error) throw new Error('No se pudieron consultar tus casos.');
  return ((data ?? []) as unknown as FilaCasoMecanico[]).map(
    convertirCasoMecanico,
  );
}

export async function obtenerCasoMecanico(
  casoId: string,
  sesion: SesionTaller,
): Promise<CasoMecanico | null> {
  if (!casoId.trim()) throw new Error('Se necesita el identificador del caso.');
  const { data, error } = await consultaDelMecanico(sesion)
    .eq('id', casoId.trim())
    .maybeSingle();
  if (error) throw new Error('No se pudo recuperar el caso.');
  return data
    ? convertirCasoMecanico(data as unknown as FilaCasoMecanico)
    : null;
}

export async function iniciarRevisionCaso(
  casoId: string,
  sesion: SesionTaller,
): Promise<void> {
  validarSesion(sesion);
  if (!casoId.trim()) throw new Error('Se necesita el identificador del caso.');
  // uso una operacion especifica: una base sin esta migracion no ejecuta la funcion anterior
  const { error } = await supabase.rpc('iniciar_revision_caso', {
    caso_objetivo: casoId.trim(),
  });
  if (!error) return;
  if (error.code === 'PGRST202' || error.code === '42883')
    throw new Error(
      'Falta actualizar la base de datos para comenzar la revisión.',
    );
  if (error.message.includes('no esta asignado'))
    throw new Error('El caso ya no está asignado a tu cuenta.');
  if (error.message.includes('transicion') || error.message.includes('cerrado'))
    throw new Error(
      'El estado del caso cambió. Actualiza el detalle antes de continuar.',
    );
  throw new Error(
    'No se pudo confirmar el inicio de la revisión. Actualiza el caso antes de reintentar.',
  );
}

function convertirCasoMecanico(fila: FilaCasoMecanico): CasoMecanico {
  if (!fila.vehiculo?.cliente || fila.asignacion?.length !== 1)
    throw new Error('No se pudo completar la información del caso.');
  return {
    ...convertirCaso(fila),
    cliente: fila.vehiculo.cliente.nombre,
    vehiculo:
      [fila.vehiculo.marca, fila.vehiculo.modelo, fila.vehiculo.anio]
        .filter(Boolean)
        .join(' ') || 'Vehículo sin detalle',
    patente: fila.vehiculo.patente ?? 'Sin patente',
    vin: fila.vehiculo.vin,
    asignacionId: fila.asignacion[0].id,
  };
}
