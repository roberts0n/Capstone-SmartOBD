import { obtenerCasoDiagnostico } from '../casos/ServicioCasosDiagnostico';
import type { SesionTaller } from '../tipos/usuarioTaller';
import { supabase } from '../servicios/clienteSupabase';
import { obtenerPermisoChatbot } from './PermisosChatbot';
import type {
  MensajeChatbot,
  NuevoMensajeUsuarioChatbot,
  TipoAutorMensajeChatbot,
} from './TiposMensajeChatbot';
import type { PerfilChatbot } from './TiposChatbot';

interface FilaMensajeChatbot {
  id: string;
  taller_id: string;
  caso_id: string;
  autor_id: string | null;
  tipo_autor: TipoAutorMensajeChatbot;
  rol_autor: PerfilChatbot | null;
  contenido: string;
  metadatos: Record<string, unknown>;
  creado_en: string;
}

const CAMPOS_MENSAJE =
  'id, taller_id, caso_id, autor_id, tipo_autor, rol_autor, contenido, metadatos, creado_en';

const LIMITE_CONTENIDO = 12000;

export async function guardarMensajeUsuario(
  entrada: NuevoMensajeUsuarioChatbot,
  sesion: SesionTaller,
): Promise<MensajeChatbot> {
  const casoId = entrada.casoId.trim();
  const contenido = entrada.contenido.trim();

  if (!casoId) {
    throw new Error('Se necesita el identificador del caso.');
  }
  if (!contenido) {
    throw new Error('El mensaje no puede estar vacio.');
  }
  if (contenido.length > LIMITE_CONTENIDO) {
    throw new Error('El mensaje supera el limite de caracteres permitido.');
  }

  const permiso = await cargarPermiso(casoId, sesion);
  if (!permiso.puedeEscribir || !permiso.modo) {
    throw new Error(permiso.motivo);
  }

  const { data, error } = await supabase
    .from('mensajes_chatbot')
    .insert({
      taller_id: sesion.tallerId,
      caso_id: casoId,
      autor_id: sesion.usuarioId,
      tipo_autor: 'usuario',
      rol_autor: permiso.modo,
      contenido,
      metadatos: entrada.metadatos ?? {},
    })
    .select(CAMPOS_MENSAJE)
    .single();

  if (error || !data) {
    throw new Error(mensajeErrorGuardado(error));
  }

  return convertirMensaje(data as FilaMensajeChatbot);
}

export async function obtenerMensajesCaso(
  casoId: string,
  sesion: SesionTaller,
): Promise<MensajeChatbot[]> {
  const identificador = casoId.trim();
  if (!identificador) {
    throw new Error('Se necesita el identificador del caso.');
  }

  const permiso = await cargarPermiso(identificador, sesion);
  if (!permiso.puedeVer) {
    throw new Error(permiso.motivo);
  }

  const { data, error } = await supabase
    .from('mensajes_chatbot')
    .select(CAMPOS_MENSAJE)
    .eq('caso_id', identificador)
    .order('creado_en', { ascending: true });

  if (error) {
    throw new Error('No se pudo recuperar la conversacion del caso.');
  }

  return ((data ?? []) as FilaMensajeChatbot[]).map(convertirMensaje);
}

async function cargarPermiso(casoId: string, sesion: SesionTaller) {
  const caso = await obtenerCasoDiagnostico(casoId);
  if (!caso) {
    throw new Error('El caso no existe o no esta disponible para tu cuenta.');
  }

  return obtenerPermisoChatbot(
    {
      usuarioId: sesion.usuarioId,
      tallerId: sesion.tallerId,
      perfil: sesion.perfil,
    },
    caso,
  );
}

function convertirMensaje(fila: FilaMensajeChatbot): MensajeChatbot {
  return {
    id: fila.id,
    tallerId: fila.taller_id,
    casoId: fila.caso_id,
    autorId: fila.autor_id,
    tipoAutor: fila.tipo_autor,
    rolAutor: fila.rol_autor,
    contenido: fila.contenido,
    metadatos: fila.metadatos,
    creadoEn: fila.creado_en,
  };
}

function mensajeErrorGuardado(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code;

  if (codigo === '42501') {
    return 'Tu cuenta no tiene permiso para escribir en esta conversacion.';
  }
  if (codigo === '23503') {
    return 'El caso ya no se encuentra disponible.';
  }

  return 'No se pudo guardar el mensaje. Intenta nuevamente.';
}
