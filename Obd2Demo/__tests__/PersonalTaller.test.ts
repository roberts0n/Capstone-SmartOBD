import { registrarPersonalTaller } from '../src/servicios/personalTaller';

const mockInvocarFuncion = jest.fn();

jest.mock('../src/servicios/clienteSupabase', () => ({
  supabase: {
    functions: {
      invoke: (...argumentos: unknown[]) => mockInvocarFuncion(...argumentos),
    },
  },
}));

describe('personal del taller', () => {
  beforeEach(() => {
    mockInvocarFuncion.mockReset();
  });

  test('envia la cuenta corporativa a la Edge Function', async () => {
    mockInvocarFuncion.mockResolvedValue({
      data: { mensaje: 'Cuenta creada.' },
      error: null,
    });

    const personal = {
      nombre: 'Tecnico de prueba',
      correo: 'tecnico@taller.cl',
      rol: 'mecanico' as const,
      especialidad: 'Electricidad',
      contrasenaTemporal: 'SmartOBD123',
    };

    await expect(registrarPersonalTaller(personal)).resolves.toBe(
      'Cuenta creada.',
    );
    expect(mockInvocarFuncion).toHaveBeenCalledWith('crear-usuario-taller', {
      body: personal,
    });
  });

  test('entrega un mensaje estable si el backend falla', async () => {
    mockInvocarFuncion.mockResolvedValue({
      data: null,
      error: new Error('FunctionsHttpError'),
    });

    await expect(
      registrarPersonalTaller({
        nombre: 'Recepcion de prueba',
        correo: 'recepcion@taller.cl',
        rol: 'recepcion',
        contrasenaTemporal: 'SmartOBD123',
      }),
    ).rejects.toThrow('No fue posible crear la cuenta. Intenta nuevamente.');
  });
});
