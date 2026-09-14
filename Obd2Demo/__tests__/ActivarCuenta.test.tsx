import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ActivarCuenta } from '../src/pantallas/activarCuenta';

test('confirma la contrasena antes de activar la cuenta', async () => {
  const activar = jest.fn().mockResolvedValue({});
  let pantalla: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    pantalla = ReactTestRenderer.create(
      <ActivarCuenta
        sesionPreparada
        alValidarCodigo={jest.fn()}
        alActivar={activar}
      />,
    );
  });

  const entradas = pantalla!.root.findAllByType(TextInput);
  await ReactTestRenderer.act(() => {
    entradas[0].props.onChangeText('Clave2026');
    entradas[1].props.onChangeText('Clave2026');
  });

  const boton = pantalla!.root.find(
    nodo =>
      nodo.props.accessibilityRole === 'button' &&
      typeof nodo.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    await boton.props.onPress();
  });

  expect(activar).toHaveBeenCalledWith('Clave2026');
});
