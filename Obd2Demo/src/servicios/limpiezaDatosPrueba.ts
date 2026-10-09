import { supabase } from './clienteSupabase';
import type { SesionTaller } from '../tipos/usuarioTaller';

export type TipoRegistroPrueba = 'caso' | 'vehiculo' | 'cliente';

export interface ResumenEliminacionPrueba {
  tipo: TipoRegistroPrueba;
  id: string;
  etiqueta: string;
  huella: string;
  cantidades: {
    clientes: number;
    vehiculos: number;
    casos: number;
    asignaciones: number;
    mensajes: number;
    snapshots: number;
    valoresPid: number;
    codigosDtc: number;
  };
}

export async function previsualizarEliminacionPrueba(
  tipo: TipoRegistroPrueba,
  id: string,
  sesion: SesionTaller,
): Promise<ResumenEliminacionPrueba> {
  validarSolicitud(tipo, id, sesion);
  const { data, error } = await supabase.rpc('previsualizar_eliminacion_prueba', {
    tipo_objetivo: tipo,
    registro_objetivo: id.trim(),
  });
  if (error) throw new Error(mensajeError(error));
  return validarResumen(data, tipo, id.trim());
}

export async function eliminarRegistroPrueba(
  resumen: ResumenEliminacionPrueba,
  confirmacion: string,
  sesion: SesionTaller,
): Promise<ResumenEliminacionPrueba> {
  validarSolicitud(resumen.tipo, resumen.id, sesion);
  validarResumen(resumen, resumen.tipo, resumen.id);
  if (confirmacion !== 'ELIMINAR') {
    throw new Error('Escribe ELIMINAR para confirmar.');
  }
  // envio la huella de lo revisado para no borrar registros nuevos sin avisar
  const { data, error } = await supabase.rpc('eliminar_registro_prueba', {
    tipo_objetivo: resumen.tipo,
    registro_objetivo: resumen.id,
    huella_revisada: resumen.huella,
    confirmacion,
  });
  if (error) throw new Error(mensajeError(error));
  return validarResumen(data, resumen.tipo, resumen.id);
}

function validarSolicitud(tipo: TipoRegistroPrueba, id: string, sesion: SesionTaller) {
  if (sesion.perfil !== 'recepcion' || sesion.debeCambiarPassword ||
      !sesion.usuarioId.trim() || !sesion.tallerId.trim()) {
    throw new Error('Solo una sesion activa de recepcion puede limpiar registros.');
  }
  if (!['caso', 'vehiculo', 'cliente'].includes(tipo) || !id.trim()) {
    throw new Error('Selecciona un registro para eliminar.');
  }
}

function validarResumen(data: unknown, tipo: TipoRegistroPrueba, id: string): ResumenEliminacionPrueba {
  const resumen = data as ResumenEliminacionPrueba | null;
  const claves: (keyof ResumenEliminacionPrueba['cantidades'])[] = [
    'clientes', 'vehiculos', 'casos', 'asignaciones', 'mensajes', 'snapshots',
    'valoresPid', 'codigosDtc',
  ];
  if (!resumen || resumen.tipo !== tipo || resumen.id !== id ||
      typeof resumen.etiqueta !== 'string' || !resumen.etiqueta.trim() ||
      typeof resumen.huella !== 'string' || !/^[a-f0-9]{32}$/.test(resumen.huella) ||
      !resumen.cantidades || claves.some(clave =>
        !Number.isSafeInteger(resumen.cantidades[clave]) || resumen.cantidades[clave] < 0)) {
    throw new Error('No se pudo confirmar el alcance. Actualiza la vista previa.');
  }
  return resumen;
}

function mensajeError(error: { code?: string; message?: string }): string {
  if (error.code === 'P0001' && error.message) return error.message;
  if (['PGRST202', '42883'].includes(error.code ?? '')) {
    return 'La limpieza no esta habilitada en la base. Falta aplicar la migracion.';
  }
  if (error.code === '42501') return 'Tu cuenta no tiene permiso para limpiar registros.';
  return 'No se pudo confirmar la operacion. Actualiza la vista previa antes de reintentar.';
}
