import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { CambiarContrasena } from '../src/pantallas/cambiarContrasena';

test('no envia contrasenas distintas al backend', async () => {
  const cambiar = jest.fn();
  let pantalla: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    pantalla = ReactTestRenderer.create(
      <CambiarContrasena alCambiar={cambiar} alCerrarSesion={jest.fn()} />,
    );
  });
  const entradas = pantalla!.root.findAllByType(TextInput);
  await ReactTestRenderer.act(() => {
    entradas[0].props.onChangeText('Mecanico2026!');
    entradas[1].props.onChangeText('OtraClave2026!');
  });
  const boton = pantalla!.root.findAll(
    nodo => nodo.props.accessibilityRole === 'button' &&
      nodo.props.children?.props?.children === 'Cambiar contrasena',
  )[0];
  await ReactTestRenderer.act(async () => {
    await boton.props.onPress();
  });
  expect(cambiar).not.toHaveBeenCalled();
});
