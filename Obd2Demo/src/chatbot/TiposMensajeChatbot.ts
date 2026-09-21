import type { PerfilChatbot } from './TiposChatbot';

export type TipoAutorMensajeChatbot =
  | 'usuario'
  | 'asistente'
  | 'sistema'
  | 'herramienta';

export interface MensajeChatbot {
  id: string;
  tallerId: string;
  casoId: string;
  autorId: string | null;
  tipoAutor: TipoAutorMensajeChatbot;
  rolAutor: PerfilChatbot | null;
  contenido: string;
  metadatos: Record<string, unknown>;
  creadoEn: string;
}

export interface NuevoMensajeUsuarioChatbot {
  casoId: string;
  contenido: string;
  metadatos?: Record<string, unknown>;
}
