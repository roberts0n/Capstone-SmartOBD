/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import Aplicacion from '../App';

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
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Aplicacion />);
  });
});
