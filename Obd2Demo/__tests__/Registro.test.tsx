import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { Registro } from '../src/pantallas/registro';

test('envia los datos del nuevo mecanico', async () => {
  const invitar = jest.fn().mockResolvedValue('Invitacion enviada.');
  let pantalla: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    pantalla = ReactTestRenderer.create(
      <Registro alInvitar={invitar} alVolver={jest.fn()} />,
    );
  });

  const entradas = pantalla!.root.findAllByType(TextInput);
  const opcionesRol = pantalla!.root.findAll(
    nodo =>
      nodo.props.accessibilityRole === 'radio' &&
      typeof nodo.props.onPress === 'function',
  );
  await ReactTestRenderer.act(() => {
    entradas[0].props.onChangeText('  Camila Soto  ');
    entradas[1].props.onChangeText('CAMILA@TALLER.CL');
    entradas[2].props.onChangeText('  Electricidad automotriz  ');
    opcionesRol[1].props.onPress();
  });

  const botones = pantalla!.root.findAll(
    nodo =>
      nodo.props.accessibilityRole === 'button' &&
      typeof nodo.props.onPress === 'function',
  );
  const botonEnviar = botones[botones.length - 1];

  await ReactTestRenderer.act(async () => {
    await botonEnviar!.props.onPress();
  });

  expect(invitar).toHaveBeenCalledWith({
    nombre: 'Camila Soto',
    correo: 'camila@taller.cl',
    rol: 'mecanico',
    especialidad: 'Electricidad automotriz',
  });
});
