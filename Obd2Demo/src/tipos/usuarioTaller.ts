export type PerfilTaller = 'recepcion' | 'mecanico';

export interface SesionTaller {
  nombre: string;
  correo: string;
  taller: string;
  perfil: PerfilTaller;
}
