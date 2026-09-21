import { cambiarContrasenaInicial } from '../src/servicios/cambioContrasena';

const mockInvocar = jest.fn();
const mockRecuperar = jest.fn();

jest.mock('../src/servicios/clienteSupabase', () => ({
  supabase: { functions: { invoke: (...argumentos: unknown[]) => mockInvocar(...argumentos) } },
}));
jest.mock('../src/servicios/autenticacionTaller', () => ({
  recuperarSesionTaller: (...argumentos: unknown[]) => mockRecuperar(...argumentos),
}));

beforeEach(() => {
  mockInvocar.mockReset();
  mockRecuperar.mockReset();
});

test('confirma el desbloqueo solo despues de que la funcion responde bien', async () => {
  const sesion = {
    usuarioId: 'juan', nombre: 'Juan', correo: 'juan@smartobd.com',
    taller: 'Taller Central', perfil: 'mecanico', debeCambiarPassword: false,
  };
  mockInvocar.mockResolvedValue({ data: { mensaje: 'Contrasena actualizada.' }, error: null });
  mockRecuperar.mockResolvedValue(sesion);
  await expect(cambiarContrasenaInicial('Mecanico2026!')).resolves.toEqual(sesion);
  expect(mockInvocar).toHaveBeenCalledWith('cambiar-password-inicial', {
    body: { nuevaContrasena: 'Mecanico2026!' },
  });
  expect(mockRecuperar).toHaveBeenCalledTimes(1);
});

test('un error de Auth no actualiza la sesion ni permite entrar', async () => {
  mockInvocar.mockResolvedValue({ data: null, error: new Error('fallo') });
  await expect(cambiarContrasenaInicial('Mecanico2026!')).rejects.toThrow();
  expect(mockRecuperar).not.toHaveBeenCalled();
});

test('una marca aun activa no permite continuar', async () => {
  mockInvocar.mockResolvedValue({ data: {}, error: null });
  mockRecuperar.mockResolvedValue({ debeCambiarPassword: true });
  await expect(cambiarContrasenaInicial('Mecanico2026!')).rejects.toThrow(
    'No se pudo confirmar el cambio.',
  );
});
