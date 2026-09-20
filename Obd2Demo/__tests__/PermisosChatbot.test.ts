import { obtenerPermisoChatbot } from '../src/chatbot/PermisosChatbot';
import type {
  CasoPermisosChatbot,
  UsuarioPermisosChatbot,
} from '../src/chatbot/TiposChatbot';

const casoBase: CasoPermisosChatbot = {
  id: 'caso-1',
  tallerId: 'taller-1',
  estado: 'diagnostico_inicial',
  recepcionId: 'recepcion-1',
  mecanicoAsignadoId: null,
};

function usuario(
  perfil: UsuarioPermisosChatbot['perfil'],
  usuarioId: string,
  tallerId = 'taller-1',
): UsuarioPermisosChatbot {
  return { usuarioId, tallerId, perfil };
}

describe('permisos del chatbot por caso', () => {
  test('el administrador queda fuera del asistente', () => {
    expect(
      obtenerPermisoChatbot(usuario('administrador', 'admin-1'), casoBase),
    ).toMatchObject({
      puedeVer: false,
      puedeEscribir: false,
      modo: null,
    });
  });

  test('la recepcion responsable puede escribir durante el ingreso', () => {
    expect(
      obtenerPermisoChatbot(usuario('recepcion', 'recepcion-1'), casoBase),
    ).toMatchObject({
      puedeVer: true,
      puedeEscribir: true,
      modo: 'recepcion',
    });
  });

  test('otro recepcionista conserva solamente la lectura', () => {
    expect(
      obtenerPermisoChatbot(usuario('recepcion', 'recepcion-2'), casoBase),
    ).toMatchObject({
      puedeVer: true,
      puedeEscribir: false,
      modo: 'recepcion',
    });
  });

  test('recepcion queda en lectura cuando el caso pasa al mecanico', () => {
    const casoAsignado = {
      ...casoBase,
      estado: 'asignado' as const,
      mecanicoAsignadoId: 'mecanico-1',
    };

    expect(
      obtenerPermisoChatbot(usuario('recepcion', 'recepcion-1'), casoAsignado),
    ).toMatchObject({ puedeVer: true, puedeEscribir: false });
  });

  test('solo el mecanico asignado puede continuar la conversacion', () => {
    const casoAsignado = {
      ...casoBase,
      estado: 'en_revision' as const,
      mecanicoAsignadoId: 'mecanico-1',
    };

    expect(
      obtenerPermisoChatbot(usuario('mecanico', 'mecanico-1'), casoAsignado),
    ).toMatchObject({
      puedeVer: true,
      puedeEscribir: true,
      modo: 'mecanico',
    });
    expect(
      obtenerPermisoChatbot(usuario('mecanico', 'mecanico-2'), casoAsignado),
    ).toMatchObject({ puedeVer: false, puedeEscribir: false, modo: null });
  });

  test('el mecanico espera la entrega formal aunque figure seleccionado', () => {
    const casoSinEntregar = {
      ...casoBase,
      mecanicoAsignadoId: 'mecanico-1',
    };

    expect(
      obtenerPermisoChatbot(usuario('mecanico', 'mecanico-1'), casoSinEntregar),
    ).toMatchObject({ puedeVer: false, puedeEscribir: false });
  });

  test('un caso cerrado queda disponible solo para consulta', () => {
    const casoCerrado = {
      ...casoBase,
      estado: 'cerrado' as const,
      mecanicoAsignadoId: 'mecanico-1',
    };

    expect(
      obtenerPermisoChatbot(usuario('recepcion', 'recepcion-1'), casoCerrado),
    ).toMatchObject({ puedeVer: true, puedeEscribir: false });
    expect(
      obtenerPermisoChatbot(usuario('mecanico', 'mecanico-1'), casoCerrado),
    ).toMatchObject({
      puedeVer: true,
      puedeEscribir: false,
      modo: 'mecanico',
    });
  });

  test('una persona de otro taller no puede ver el caso', () => {
    expect(
      obtenerPermisoChatbot(
        usuario('recepcion', 'recepcion-1', 'taller-2'),
        casoBase,
      ),
    ).toMatchObject({ puedeVer: false, puedeEscribir: false, modo: null });
  });
});
