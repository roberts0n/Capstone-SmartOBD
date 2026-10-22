import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import type { ModoTema } from '../tema/tokensTema';
import { supabase } from './clienteSupabase';

const almacenamientoTema = createAsyncStorage('smartobd-tema');

export async function leerPreferenciaLocal(
  usuarioId: string,
): Promise<ModoTema | null> {
  try {
    const valor = await almacenamientoTema.getItem(usuarioId);
    return esModoTema(valor) ? valor : null;
  } catch {
    return null;
  }
}

export async function leerPreferenciaRemota(
  usuarioId: string,
): Promise<ModoTema | null> {
  try {
    const { data, error } = await supabase
      .from('preferencias_usuario')
      .select('modo_tema')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (error || !data) return null;
    return esModoTema(data.modo_tema) ? data.modo_tema : null;
  } catch {
    return null;
  }
}

export async function guardarPreferenciaTema(
  usuarioId: string,
  modo: ModoTema,
  sincronizarRemoto: boolean,
): Promise<void> {
  await almacenamientoTema.setItem(usuarioId, modo).catch(() => undefined);
  if (!sincronizarRemoto) return;

  try {
    await supabase.from('preferencias_usuario').upsert(
      {
        usuario_id: usuarioId,
        modo_tema: modo,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'usuario_id' },
    );
  } catch {
    // La copia local sigue funcionando aunque Supabase no esté disponible.
  }
}

function esModoTema(valor: unknown): valor is ModoTema {
  return valor === 'claro' || valor === 'oscuro';
}
