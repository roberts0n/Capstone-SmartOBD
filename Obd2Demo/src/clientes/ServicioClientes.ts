import type { SesionTaller } from '../tipos/usuarioTaller';
import { supabase } from '../servicios/clienteSupabase';
import type { ClienteTaller, NuevoClienteTaller } from './TiposCliente';

interface FilaCliente {
  id: string;
  taller_id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  observaciones: string | null;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
}

const CAMPOS_CLIENTE =
  'id, taller_id, nombre, telefono, correo, observaciones, creado_por, creado_en, actualizado_en';

export async function crearCliente(
  entrada: NuevoClienteTaller,
  sesion: SesionTaller,
): Promise<ClienteTaller> {
  validarSesionRecepcion(sesion);

  const nombre = entrada.nombre.trim();
  if (nombre.length < 2) {
    throw new Error('El nombre del cliente debe tener al menos 2 caracteres.');
  }

  const correo = textoOpcional(entrada.correo)?.toLowerCase() ?? null;
  if (correo && !esCorreoValido(correo)) {
    throw new Error('El correo del cliente no tiene un formato valido.');
  }

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      taller_id: sesion.tallerId,
      nombre,
      telefono: textoOpcional(entrada.telefono),
      correo,
      observaciones: textoOpcional(entrada.observaciones),
      creado_por: sesion.usuarioId,
    })
    .select(CAMPOS_CLIENTE)
    .single();

  if (error || !data) {
    throw new Error(mensajeErrorCreacion(error));
  }

  return convertirCliente(data as FilaCliente);
}

export async function obtenerCliente(
  clienteId: string,
): Promise<ClienteTaller | null> {
  const identificador = clienteId.trim();
  if (!identificador) {
    throw new Error('Se necesita el identificador del cliente.');
  }

  const { data, error } = await supabase
    .from('clientes')
    .select(CAMPOS_CLIENTE)
    .eq('id', identificador)
    .maybeSingle();

  if (error) {
    throw new Error('No se pudo recuperar el cliente.');
  }

  return data ? convertirCliente(data as FilaCliente) : null;
}

export async function listarClientes(): Promise<ClienteTaller[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select(CAMPOS_CLIENTE)
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error('No se pudo obtener la lista de clientes.');
  }

  return ((data ?? []) as FilaCliente[]).map(convertirCliente);
}

function validarSesionRecepcion(sesion: SesionTaller): void {
  if (sesion.perfil !== 'recepcion') {
    throw new Error('Solo recepcion puede registrar clientes.');
  }
  if (!sesion.tallerId.trim() || !sesion.usuarioId.trim()) {
    throw new Error('La sesion no contiene los datos necesarios del taller.');
  }
}

function textoOpcional(valor: string | null | undefined): string | null {
  return valor?.trim() || null;
}

function esCorreoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function convertirCliente(fila: FilaCliente): ClienteTaller {
  return {
    id: fila.id,
    tallerId: fila.taller_id,
    nombre: fila.nombre,
    telefono: fila.telefono,
    correo: fila.correo,
    observaciones: fila.observaciones,
    creadoPor: fila.creado_por,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

function mensajeErrorCreacion(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code;

  if (codigo === '42501') {
    return 'Tu cuenta no tiene permiso para registrar clientes.';
  }

  return 'No se pudo registrar el cliente. Intenta nuevamente.';
}
