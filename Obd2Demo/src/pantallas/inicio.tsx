import React from 'react';
import type { SesionTaller } from '../tipos/usuarioTaller';
import { InicioAdministrador } from './inicioAdministrador';
import { InicioMecanico } from './inicioMecanico';
import { InicioRecepcion } from './inicioRecepcion';

interface PropiedadesInicio {
  sesion: SesionTaller;
  alAbrirEscaner: () => void;
  alAbrirRegistro: () => void;
  alAbrirCuenta: () => void;
  alAbrirNuevaOrden: () => void;
  alAbrirCasosRecepcion: () => void;
  alAbrirCasosMecanico: () => void;
  alAbrirCasoMecanico: (casoId: string) => void;
}

export function Inicio({
  sesion,
  alAbrirEscaner,
  alAbrirRegistro,
  alAbrirCuenta,
  alAbrirNuevaOrden,
  alAbrirCasosRecepcion,
  alAbrirCasosMecanico,
  alAbrirCasoMecanico,
}: PropiedadesInicio) {
  if (sesion.perfil === 'recepcion') {
    return (
      <InicioRecepcion
        sesion={sesion}
        alAbrirCuenta={alAbrirCuenta}
        alAbrirNuevaOrden={alAbrirNuevaOrden}
        alAbrirCasos={alAbrirCasosRecepcion}
      />
    );
  }

  if (sesion.perfil === 'administrador') {
    return <InicioAdministrador alAbrirRegistro={alAbrirRegistro} />;
  }

  return (
    <InicioMecanico
      sesion={sesion}
      alAbrirCuenta={alAbrirCuenta}
      alAbrirEscaner={alAbrirEscaner}
      alAbrirCasos={alAbrirCasosMecanico}
      alAbrirCaso={alAbrirCasoMecanico}
    />
  );
}

export default Inicio;
