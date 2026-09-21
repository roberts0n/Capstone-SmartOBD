import { iniciarSesionTaller } from '../src/servicios/autenticacionTaller';

const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockPerfil = jest.fn();
const mockTaller = jest.fn();

jest.mock('../src/servicios/clienteSupabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...argumentos: unknown[]) => mockSignIn(...argumentos),
      signOut: (...argumentos: unknown[]) => mockSignOut(...argumentos),
    },
    from: (tabla: string) => ({
      select: () => ({
        eq: () => ({ single: () => tabla === 'perfiles' ? mockPerfil() : mockTaller() }),
      }),
    }),
  },
}));

beforeEach(() => {
  mockSignIn.mockReset().mockResolvedValue({
    data: { user: { id: 'juan', email: 'juan@smartobd.com' } }, error: null,
  });
  mockSignOut.mockReset().mockResolvedValue({ error: null });
  mockPerfil.mockReset();
  mockTaller.mockReset();
});

test('primer login obtiene el perfil pero no consulta ni abre el taller', async () => {
  mockPerfil.mockResolvedValue({ data: {
    id: 'juan', taller_id: 'taller-1', nombre: 'Juan Perez',
    rol: 'mecanico', activo: true, debe_cambiar_password: true,
  }, error: null });
  await expect(iniciarSesionTaller('juan@smartobd.com', 'SmartOBD123'))
    .resolves.toMatchObject({ perfil: 'mecanico', debeCambiarPassword: true });
  expect(mockTaller).not.toHaveBeenCalled();
});

test('un usuario inactivo es rechazado y se cierra su sesion', async () => {
  mockPerfil.mockResolvedValue({ data: {
    id: 'juan', taller_id: 'taller-1', nombre: 'Juan Perez',
    rol: 'mecanico', activo: false, debe_cambiar_password: false,
  }, error: null });
  await expect(iniciarSesionTaller('juan@smartobd.com', 'Mecanico2026!'))
    .rejects.toThrow('Tu cuenta se encuentra desactivada. Contacta al administrador.');
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockTaller).not.toHaveBeenCalled();
});
