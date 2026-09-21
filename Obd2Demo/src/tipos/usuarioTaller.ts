export type PerfilTaller = 'administrador' | 'recepcion' | 'mecanico';

export interface SesionTaller {
  usuarioId: string;
  nombre: string;
  correo: string;
  taller: string;
  perfil: PerfilTaller;
  debeCambiarPassword: boolean;
}
