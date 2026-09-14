import { invitarPersonalTaller } from '../src/servicios/personalTaller';

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

  test('envia la invitacion a la Edge Function', async () => {
    mockInvocarFuncion.mockResolvedValue({
      data: { mensaje: 'Invitacion enviada a tecnico@taller.cl.' },
      error: null,
    });

    const invitacion = {
      nombre: 'Tecnico de prueba',
      correo: 'tecnico@taller.cl',
      rol: 'mecanico' as const,
      especialidad: 'Electricidad',
    };

    await expect(invitarPersonalTaller(invitacion)).resolves.toBe(
      'Invitacion enviada a tecnico@taller.cl.',
    );
    expect(mockInvocarFuncion).toHaveBeenCalledWith('crear-usuario-taller', {
      body: invitacion,
    });
  });

  test('entrega un mensaje estable si el backend falla', async () => {
    mockInvocarFuncion.mockResolvedValue({
      data: null,
      error: new Error('FunctionsHttpError'),
    });

    await expect(
      invitarPersonalTaller({
        nombre: 'Recepcion de prueba',
        correo: 'recepcion@taller.cl',
        rol: 'recepcion',
      }),
    ).rejects.toThrow('No se pudo enviar la invitacion. Intenta nuevamente.');
  });
});
