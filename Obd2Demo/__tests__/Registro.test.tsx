import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { Registro } from '../src/pantallas/registro';

test('envia los datos del nuevo mecanico', async () => {
  const registrar = jest.fn().mockResolvedValue('Cuenta creada.');
  let pantalla: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    pantalla = ReactTestRenderer.create(
      <Registro alRegistrar={registrar} alVolver={jest.fn()} />,
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
    opcionesRol[1].props.onPress();
  });

  const entradasMecanico = pantalla!.root.findAllByType(TextInput);
  await ReactTestRenderer.act(() => {
    entradasMecanico[2].props.onChangeText('  Electricidad automotriz  ');
    entradasMecanico[3].props.onChangeText('SmartOBD123');
    entradasMecanico[4].props.onChangeText('SmartOBD123');
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

  expect(registrar).toHaveBeenCalledWith({
    nombre: 'Camila Soto',
    correo: 'camila@taller.cl',
    rol: 'mecanico',
    especialidad: 'Electricidad automotriz',
    contrasenaTemporal: 'SmartOBD123',
  });
});

test('rechaza contrasenas temporales distintas antes de llamar al servidor', async () => {
  const registrar = jest.fn();
  let pantalla: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    pantalla = ReactTestRenderer.create(
      <Registro alRegistrar={registrar} alVolver={jest.fn()} />,
    );
  });
  const entradas = pantalla!.root.findAllByType(TextInput);
  await ReactTestRenderer.act(() => {
    entradas[0].props.onChangeText('Juan Perez');
    entradas[1].props.onChangeText('JUAN@SMARTOBD.COM');
    entradas[2].props.onChangeText('SmartOBD123');
    entradas[3].props.onChangeText('OtraClave2026');
  });
  const boton = pantalla!.root.findAll(
    nodo => nodo.props.accessibilityRole === 'button' &&
      typeof nodo.props.onPress === 'function',
  ).at(-1);
  await ReactTestRenderer.act(async () => {
    await boton!.props.onPress();
  });
  expect(registrar).not.toHaveBeenCalled();
  expect(pantalla!.root.findAllByType(Text).some(
    nodo => nodo.props.children === 'Las contrasenas no coinciden.',
  )).toBe(true);
});
