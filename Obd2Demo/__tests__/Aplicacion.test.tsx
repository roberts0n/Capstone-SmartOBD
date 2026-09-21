/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import Aplicacion from '../App';
import { CambiarContrasena } from '../src/pantallas/cambiarContrasena';
import { Inicio } from '../src/pantallas/inicio';
import { Registro } from '../src/pantallas/registro';
import { HerramientasRol } from '../src/pantallas/herramientasRol';
import { Cuenta } from '../src/pantallas/cuenta';
import { BarraNavegacionInferior } from '../src/componentes/BarraNavegacionInferior';

const mockRecuperarSesion = jest.fn().mockResolvedValue(null);

jest.mock('../src/servicios/autenticacionTaller', () => ({
  recuperarSesionTaller: (...argumentos: unknown[]) => mockRecuperarSesion(...argumentos),
  iniciarSesionTaller: jest.fn(),
  cerrarSesionTaller: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const almacenamiento = {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  };
  return { createAsyncStorage: jest.fn(() => almacenamiento) };
});

jest.mock('react-native-ble-plx', () => ({
  State: {
    Unknown: 'Unknown',
    Resetting: 'Resetting',
    Unsupported: 'Unsupported',
    Unauthorized: 'Unauthorized',
    PoweredOff: 'PoweredOff',
    PoweredOn: 'PoweredOn',
  },
  BleManager: jest.fn().mockImplementation(() => ({
    state: jest.fn().mockResolvedValue('PoweredOn'),
    onStateChange: jest.fn(() => ({ remove: jest.fn() })),
    stopDeviceScan: jest.fn(),
    startDeviceScan: jest.fn(),
    destroy: jest.fn(),
  })),
}));

test('renderiza la aplicacion correctamente', async () => {
  mockRecuperarSesion.mockResolvedValueOnce(null);
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<Aplicacion />);
    await Promise.resolve();
  });
});

test('un primer inicio no puede renderizar Inicio aunque la ruta sea inicio', async () => {
  mockRecuperarSesion.mockReset();
  mockRecuperarSesion.mockResolvedValue({
    usuarioId: 'usuario-1',
    nombre: 'Juan Perez',
    correo: 'juan@smartobd.com',
    taller: '',
    perfil: 'mecanico',
    debeCambiarPassword: true,
  });
  let pantalla: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    pantalla = ReactTestRenderer.create(<Aplicacion />);
    await Promise.resolve();
  });
  expect(mockRecuperarSesion).toHaveBeenCalledTimes(1);
  expect(pantalla!.root.findAllByType(CambiarContrasena)).toHaveLength(1);
  expect(pantalla!.root.findAllByType(Inicio)).toHaveLength(0);
  expect(pantalla!.root.findAllByType(BarraNavegacionInferior)).toHaveLength(0);
});

test('administrador abre Personal y Cuenta desde la barra', async () => {
  mockRecuperarSesion.mockReset().mockResolvedValue({
    usuarioId: 'admin-1', nombre: 'Ana', correo: 'ana@smartobd.com',
    taller: 'Taller', perfil: 'administrador', debeCambiarPassword: false,
  });
  let pantalla: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    pantalla = ReactTestRenderer.create(<Aplicacion />);
    await Promise.resolve();
  });
  expect(pantalla!.root.findAllByType(Inicio)).toHaveLength(1);
  await ReactTestRenderer.act(() => {
    pantalla!.root.findByType(BarraNavegacionInferior).props.alNavegar('registro');
  });
  expect(pantalla!.root.findAllByType(Registro)).toHaveLength(1);
  await ReactTestRenderer.act(() => {
    pantalla!.root.findByType(BarraNavegacionInferior).props.alNavegar('cuenta');
  });
  expect(pantalla!.root.findAllByType(Cuenta)).toHaveLength(1);
});

test('mecanico no puede abrir Registro por navegacion manual', async () => {
  mockRecuperarSesion.mockReset().mockResolvedValue({
    usuarioId: 'mec-1', nombre: 'Juan', correo: 'juan@smartobd.com',
    taller: 'Taller', perfil: 'mecanico', debeCambiarPassword: false,
  });
  let pantalla: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    pantalla = ReactTestRenderer.create(<Aplicacion />);
    await Promise.resolve();
  });
  await ReactTestRenderer.act(() => {
    pantalla!.root.findByType(BarraNavegacionInferior).props.alNavegar('registro');
  });
  expect(pantalla!.root.findAllByType(Registro)).toHaveLength(0);
  await ReactTestRenderer.act(() => {
    pantalla!.root.findByType(BarraNavegacionInferior).props.alNavegar('herramientas');
  });
  expect(pantalla!.root.findAllByType(HerramientasRol)).toHaveLength(1);
});
