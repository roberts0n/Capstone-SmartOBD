import type {
  CasoPermisosChatbot,
  EstadoCasoChatbot,
  PermisoChatbot,
  UsuarioPermisosChatbot,
} from './TiposChatbot';

const ESTADOS_RECEPCION: readonly EstadoCasoChatbot[] = [
  'ingresado',
  'diagnostico_inicial',
];

const ESTADOS_MECANICO: readonly EstadoCasoChatbot[] = [
  'asignado',
  'en_revision',
  'diagnosticado',
];

export function obtenerPermisoChatbot(
  usuario: UsuarioPermisosChatbot,
  caso: CasoPermisosChatbot,
): PermisoChatbot {
  if (usuario.perfil === 'administrador') {
    return sinAcceso('El perfil administrador no utiliza el asistente.');
  }

  if (usuario.tallerId !== caso.tallerId) {
    return sinAcceso('El caso pertenece a otro taller.');
  }

  if (usuario.perfil === 'recepcion') {
    return permisoRecepcion(usuario, caso);
  }

  return permisoMecanico(usuario, caso);
}

function permisoRecepcion(
  usuario: UsuarioPermisosChatbot,
  caso: CasoPermisosChatbot,
): PermisoChatbot {
  if (caso.estado === 'cerrado') {
    return soloLectura('El caso esta cerrado.');
  }

  if (!ESTADOS_RECEPCION.includes(caso.estado)) {
    return soloLectura('El caso ya se encuentra en manos del mecanico.');
  }

  if (caso.recepcionId !== usuario.usuarioId) {
    return soloLectura('Otro recepcionista tiene la responsabilidad del caso.');
  }

  return {
    puedeVer: true,
    puedeEscribir: true,
    modo: 'recepcion',
    motivo: 'Recepcion mantiene la responsabilidad del caso.',
  };
}

function permisoMecanico(
  usuario: UsuarioPermisosChatbot,
  caso: CasoPermisosChatbot,
): PermisoChatbot {
  if (caso.mecanicoAsignadoId !== usuario.usuarioId) {
    return sinAcceso('El caso no esta asignado a este mecanico.');
  }

  if (caso.estado === 'cerrado') {
    return {
      puedeVer: true,
      puedeEscribir: false,
      modo: 'mecanico',
      motivo: 'El caso esta cerrado.',
    };
  }

  if (!ESTADOS_MECANICO.includes(caso.estado)) {
    return sinAcceso('Recepcion aun no entrega formalmente el caso.');
  }

  return {
    puedeVer: true,
    puedeEscribir: true,
    modo: 'mecanico',
    motivo: 'El mecanico asignado mantiene la responsabilidad del caso.',
  };
}

function soloLectura(motivo: string): PermisoChatbot {
  return {
    puedeVer: true,
    puedeEscribir: false,
    modo: 'recepcion',
    motivo,
  };
}

function sinAcceso(motivo: string): PermisoChatbot {
  return {
    puedeVer: false,
    puedeEscribir: false,
    modo: null,
    motivo,
  };
}
