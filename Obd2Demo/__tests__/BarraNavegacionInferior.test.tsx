import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BarraNavegacionInferior } from '../src/componentes/BarraNavegacionInferior';
import type { PerfilTaller } from '../src/tipos/usuarioTaller';

const ETIQUETAS: Record<PerfilTaller, string[]> = {
  administrador: ['Inicio', 'Personal', 'Escáner', 'Cuenta'],
  recepcion: ['Inicio', 'Recepción', 'Escáner', 'Cuenta'],
  mecanico: ['Inicio', 'Trabajo', 'Escáner', 'Cuenta'],
};

test.each<PerfilTaller>(['administrador', 'recepcion', 'mecanico'])(
  'muestra solo las opciones del rol %s', async perfil => {
    const navegar = jest.fn();
    let barra: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      barra = ReactTestRenderer.create(
        <BarraNavegacionInferior
          perfil={perfil}
          destinoActivo="inicio"
          alNavegar={navegar}
        />,
      );
    });

    const pestañas = barra!.root.findAll(
      nodo => nodo.props.accessibilityRole === 'tab',
    ).filter((nodo, indice, todos) =>
      todos.findIndex(actual => actual.props.accessibilityLabel ===
        nodo.props.accessibilityLabel) === indice,
    );
    expect(pestañas.map(nodo => nodo.props.accessibilityLabel)).toEqual(
      ETIQUETAS[perfil],
    );
    expect(pestañas[0].props.accessibilityState.selected).toBe(true);

    await ReactTestRenderer.act(() => pestañas[2].props.onPress());
    expect(navegar).toHaveBeenCalledWith('escaner');
  },
);
