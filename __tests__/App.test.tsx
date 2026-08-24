/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

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

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
