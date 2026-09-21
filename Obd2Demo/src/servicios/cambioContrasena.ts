import type { SesionTaller } from '../tipos/usuarioTaller';
import { recuperarSesionTaller } from './autenticacionTaller';
import { supabase } from './clienteSupabase';

export async function cambiarContrasenaInicial(
  nuevaContrasena: string,
): Promise<SesionTaller> {
  const { error } = await supabase.functions.invoke('cambiar-password-inicial', {
    body: { nuevaContrasena },
  });
  if (error) {
    const contexto = (error as { context?: unknown }).context;
    if (contexto instanceof Response) {
      try {
        const cuerpo = (await contexto.clone().json()) as { error?: string };
        if (cuerpo.error) throw new Error(cuerpo.error);
      } catch (capturado) {
        if (capturado instanceof Error && !(capturado instanceof SyntaxError)) {
          throw capturado;
        }
      }
    }
    throw new Error('No fue posible cambiar la contrasena. Intentalo nuevamente.');
  }

  const sesion = await recuperarSesionTaller();
  if (!sesion || sesion.debeCambiarPassword) {
    throw new Error('No se pudo confirmar el cambio. Intenta iniciar sesion nuevamente.');
  }
  return sesion;
}
