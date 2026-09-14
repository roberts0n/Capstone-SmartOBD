import {
  activarCuentaInvitada,
  prepararActivacionDesdeEnlace,
  validarCodigoInvitacion,
} from '../src/servicios/activacionCuenta';
import { recuperarSesionTaller } from '../src/servicios/autenticacionTaller';

const mockSetSession = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockUpdateUser = jest.fn();
const mockVerifyOtp = jest.fn();

jest.mock('../src/servicios/clienteSupabase', () => ({
  supabase: {
    auth: {
      setSession: (...argumentos: unknown[]) => mockSetSession(...argumentos),
      exchangeCodeForSession: (...argumentos: unknown[]) =>
        mockExchangeCodeForSession(...argumentos),
      updateUser: (...argumentos: unknown[]) => mockUpdateUser(...argumentos),
      verifyOtp: (...argumentos: unknown[]) => mockVerifyOtp(...argumentos),
    },
  },
}));

jest.mock('../src/servicios/autenticacionTaller', () => ({
  recuperarSesionTaller: jest.fn(),
}));

const recuperarSesionMock = recuperarSesionTaller as jest.MockedFunction<
  typeof recuperarSesionTaller
>;

describe('activacion de cuenta invitada', () => {
  beforeEach(() => {
    mockSetSession.mockReset();
    mockExchangeCodeForSession.mockReset();
    mockUpdateUser.mockReset();
    mockVerifyOtp.mockReset();
    recuperarSesionMock.mockReset();
  });

  test('acepta los tokens entregados en el enlace movil', async () => {
    mockSetSession.mockResolvedValue({ error: null });

    await expect(
      prepararActivacionDesdeEnlace(
        'smartobd://activar-cuenta#access_token=acceso&refresh_token=refresco&type=invite',
      ),
    ).resolves.toBe(true);

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'acceso',
      refresh_token: 'refresco',
    });
  });

  test('ignora enlaces que no corresponden a la activacion', async () => {
    await expect(
      prepararActivacionDesdeEnlace('smartobd://escaner'),
    ).resolves.toBe(false);
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  test('guarda la contrasena y carga el perfil', async () => {
    const sesion = {
      usuarioId: 'usuario-1',
      nombre: 'Camila Soto',
      correo: 'camila@taller.cl',
      taller: 'Taller SmartOBD',
      perfil: 'mecanico' as const,
    };
    mockUpdateUser.mockResolvedValue({ error: null });
    recuperarSesionMock.mockResolvedValue(sesion);

    await expect(activarCuentaInvitada('Clave2026')).resolves.toEqual(sesion);
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'Clave2026' });
  });

  test('valida manualmente el codigo de invitacion', async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    await expect(
      validarCodigoInvitacion(' INVITADO@TALLER.CL ', '1234 5678'),
    ).resolves.toBeUndefined();
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'invitado@taller.cl',
      token: '12345678',
      type: 'invite',
    });
  });
});
