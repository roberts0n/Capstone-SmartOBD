import type { SesionTaller } from '../tipos/usuarioTaller';
import { supabase } from '../servicios/clienteSupabase';
import type { ClienteTaller, NuevoClienteTaller } from './TiposCliente';

interface FilaCliente {
  id: string;
  taller_id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
}

const CAMPOS_CLIENTE =
  'id, taller_id, nombre, telefono, correo, creado_por, creado_en, actualizado_en';

export async function actualizarCliente(
  clienteId: string,
  entrada: NuevoClienteTaller,
  sesion: SesionTaller,
): Promise<ClienteTaller> {
  validarSesionRecepcion(sesion);
  if (!clienteId.trim())
    throw new Error('Se necesita el identificador del cliente.');
  const nombre = entrada.nombre.trim();
  if (nombre.length < 2)
    throw new Error('El nombre del cliente debe tener al menos 2 caracteres.');
  const correo = textoOpcional(entrada.correo)?.toLowerCase() ?? null;
  if (correo && !esCorreoValido(correo))
    throw new Error('El correo del cliente no tiene un formato valido.');
  const telefono = normalizarTelefonoChileno(entrada.telefono);
  // envio solo los campos del formulario, no los ids ni los datos de autoria
  const { data, error } = await supabase
    .from('clientes')
    .update({ nombre, telefono, correo })
    .eq('id', clienteId.trim())
    .eq('taller_id', sesion.tallerId)
    .select(CAMPOS_CLIENTE)
    .maybeSingle();
  if (error || !data)
    throw new Error(
      'No se pudo actualizar el cliente. Revisa los datos y tus permisos.',
    );
  return convertirCliente(data as FilaCliente);
}

// mantengo el mismo formato que pide la base, sin adivinar digitos faltantes
const TELEFONO_NACIONAL_CHILENO =
  /^(?:[29][0-9]{8}|(?:32|33|34|35|41|42|43|45|51|52|53|55|57|58|61|63|64|65|67|71|72|73|75)[0-9]{7}|44[2-9][0-9]{6})$/;

export function prepararTelefonoParaEntrada(valor: string): string {
  const compacto = valor.replace(/[\s().-]/g, '');
  if (compacto.startsWith('+56')) return compacto.slice(3);
  if (/^56[0-9]{9}$/.test(compacto)) return compacto.slice(2);
  return compacto;
}

export function normalizarTelefonoChileno(
  valor: string | null | undefined,
): string {
  if (!valor?.trim()) {
    throw new Error('Ingresa un telefono de contacto.');
  }
  const nacional = prepararTelefonoParaEntrada(valor);
  if (!/^[0-9]{9}$/.test(nacional)) {
    throw new Error(
      'El telefono debe tener 9 digitos nacionales, sin contar +56.',
    );
  }
  if (!TELEFONO_NACIONAL_CHILENO.test(nacional)) {
    throw new Error(
      'Ingresa un numero chileno movil, fijo o de telefonia IP valido.',
    );
  }
  return `+56${nacional}`;
}

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

  const telefono = normalizarTelefonoChileno(entrada.telefono);

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      taller_id: sesion.tallerId,
      nombre,
      telefono,
      correo,
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

export interface ConsultaClientes {
  busqueda?: string;
  desde?: number;
  limite?: number;
}

export async function listarClientes(
  opciones?: ConsultaClientes,
): Promise<ClienteTaller[]> {
  const desde = opciones?.desde ?? 0;
  const limite = opciones?.limite ?? 20;
  if (
    opciones &&
    (!Number.isSafeInteger(desde) ||
      desde < 0 ||
      !Number.isInteger(limite) ||
      limite < 1 ||
      limite > 100 ||
      !Number.isSafeInteger(desde + limite))
  ) {
    throw new Error('El rango de clientes solicitado no es valido.');
  }

  let consulta = supabase
    .from('clientes')
    .select(CAMPOS_CLIENTE)
    .order('nombre', { ascending: true });

  if (opciones) {
    // ordeno tambien por id para que dos nombres iguales no salten entre paginas
    consulta = consulta.order('id', { ascending: true });
    const texto = opciones.busqueda?.trim() ?? '';
    if (texto.length > 120) {
      throw new Error('La busqueda debe tener como maximo 120 caracteres.');
    }
    if (texto) {
      const busqueda = /^[+0-9\s().-]+$/.test(texto)
        ? texto.replace(/[\s().-]/g, '')
        : texto;
      // paso el texto como un valor, sin dejar que cambie los filtros de la consulta
      const literal = busqueda.replace(/[\\%_]/g, caracter => `\\${caracter}`);
      const patron = JSON.stringify(`%${literal}%`);
      consulta = consulta.or(
        `nombre.ilike.${patron},telefono.ilike.${patron},correo.ilike.${patron}`,
      );
    }
    consulta = consulta.range(desde, desde + limite - 1);
  }

  const { data, error } = await consulta;

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
  if (codigo === '23514' || codigo === '23502') {
    return 'Revisa el telefono de contacto antes de guardar.';
  }

  return 'No se pudo registrar el cliente. Intenta nuevamente.';
}
