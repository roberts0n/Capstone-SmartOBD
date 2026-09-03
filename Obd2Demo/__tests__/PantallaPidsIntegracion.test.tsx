import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PantallaEscanerObd } from '../src/pantallas/PantallaEscanerObd';
import { SelectorEscaneres } from '../src/componentes/SelectorEscaneres';
import { PanelPidsCompatibles } from '../src/componentes/PanelPidsCompatibles';

jest.setTimeout(30000);
jest.mock('react-native-ble-plx', () => ({
  State: {
    Unknown: 'Unknown',
    Resetting: 'Resetting',
    Unsupported: 'Unsupported',
    Unauthorized: 'Unauthorized',
    PoweredOff: 'PoweredOff',
    PoweredOn: 'PoweredOn',
  },
}));
const mockCanal = {
  uuidServicio: '0000fff0-0000-1000-8000-00805f9b34fb',
  uuidCaracteristica: '0000fff1-0000-1000-8000-00805f9b34fb',
  permiteEscrituraConRespuesta: true,
  permiteNotificacion: true,
};
const mockDispositivo = {
  id: 'prueba',
  nombre: 'OBDII',
  nombreLocal: null,
  rssi: -50,
};
let mockEstado: (estado: string) => void;
let mockDesconexion: () => void;
let mockRespuestas: Record<string, string>;
const mockEnviar = jest.fn(async (_id, _canal, comando: string) => ({
  textoAscii: mockRespuestas[comando] ?? 'NO DATA\r>',
  bytes: [],
  metricasRecepcion: {
    inicioComandoMs: 0,
    escrituraBleCompletaMs: 1,
    primerFragmentoMs: 2,
    respuestaCompletaMs: 3,
    cantidadFragmentos: 1,
    cantidadBytes: 8,
  },
}));

jest.mock('../src/ble/ServicioBle', () => ({
  esBluetoothNoDisponible: (estado: string) => estado === 'Unsupported',
  esBluetoothUtilizable: (estado: string) => estado === 'PoweredOn',
  ServicioBle: jest.fn(() => ({
    observarEstadoBluetooth: (callback: typeof mockEstado) => {
      mockEstado = callback;
      return { remove: jest.fn() };
    },
    solicitarPermisosAndroid: jest.fn().mockResolvedValue(true),
    obtenerEstadoBluetooth: jest.fn().mockResolvedValue('PoweredOn'),
    detenerEscaneo: jest.fn(),
    desconectar: jest.fn().mockResolvedValue(undefined),
    destruir: jest.fn().mockResolvedValue(undefined),
    conectarYDescubrir: jest.fn(async () => ({
      dispositivo: { id: 'prueba', name: 'OBDII' },
      caracteristicas: [mockCanal],
    })),
    observarDesconexion: (_id: string, callback: typeof mockDesconexion) => {
      mockDesconexion = callback;
      return { remove: jest.fn() };
    },
  })),
}));
jest.mock('../src/obd/ServicioElm327', () => ({
  ...jest.requireActual('../src/obd/ServicioElm327'),
  ServicioElm327: jest.fn(() => ({
    enviarComando: mockEnviar,
    estaSuscrito: () => true,
    cancelarSuscripcion: jest.fn(),
    suscribirse: jest.fn(),
  })),
}));
jest.mock('../src/escaneres/usarEscaneresGuardados', () => ({
  useEscaneresGuardados: () => ({
    guardados: [],
    cargando: false,
    error: null,
    buscar: () => ({ escritura: mockCanal, notificacion: mockCanal }),
    guardar: jest.fn(),
    olvidar: jest.fn(),
  }),
}));
jest.mock('../src/informes/usarPruebaDtc', () => ({
  usePruebaDtc: () => ({
    informe: null,
    progreso: '',
    notas: '',
    cargando: false,
    ejecutando: false,
    guardando: false,
    error: null,
    establecerNotas: jest.fn(),
    iniciar: jest.fn(),
    detener: jest.fn(),
    guardar: jest.fn(),
  }),
}));

let vista: TestRenderer.ReactTestRenderer;
const accion = (etiqueta: string) =>
  vista.root.findAll(nodo => nodo.props.etiqueta === etiqueta)[0];
const panel = () => vista.root.findByType(PanelPidsCompatibles);
const conectar = () =>
  vista.root.findByType(SelectorEscaneres).props.alConectar(mockDispositivo);

beforeEach(async () => {
  mockEnviar.mockClear();
  mockRespuestas = {
    '0100': '41 00 98 3B A0 13\r41 00 98 18 00 01\r>',
    '0120': '41 20 B0 19 A0 01\r41 20 00 00 00 01\r>',
    '0140': '41 40 CC D2 00 00\r41 40 C0 80 00 00\r>',
    '014F': '41 4F 00 00 00 00\r>',
    '0146': '41 46 41\r>',
  };
  await act(async () => {
    vista = TestRenderer.create(<PantallaEscanerObd />);
  });
  await act(async () => {
    await conectar();
  });
});
afterEach(async () => {
  await act(async () => {
    vista.unmount();
  });
});

test('flujo completo detecta, prepara escalas, muestra 28 y consulta bajo demanda', async () => {
  expect(panel().props.deteccion).toBeNull();
  await act(async () => {
    await accion('Detectar PID compatibles').props.onPress();
  });
  expect(mockEnviar.mock.calls.map(llamada => llamada[2])).toEqual([
    '0100',
    '0120',
    '0140',
    '014F',
  ]);
  expect(panel().props.deteccion.cantidadInterpretables).toBe(28);
  await act(async () => {
    await panel().props.alConsultar('0146');
  });
  expect(mockEnviar.mock.calls.at(-1)?.[2]).toBe('0146');
  expect(JSON.stringify(vista.toJSON())).toContain('datoTraducido');
  expect(JSON.stringify(vista.toJSON())).toContain('25');
  await act(async () => {
    await accion('Desconectar').props.onPress();
  });
  expect(panel().props.deteccion).toBeNull();
  mockRespuestas = { '0100': '41 00 00 10 00 00\r>' };
  await act(async () => {
    await conectar();
  });
  // La conexion nueva exige una deteccion nueva, sin conservar el auto anterior.
  await act(async () => {
    await accion('Detectar PID compatibles').props.onPress();
  });
  expect(panel().props.deteccion.pidsSoportados).toEqual(['010C']);
});

test.each(['bluetooth', 'fisica'])(
  'limpia la deteccion al perder conexion: %s',
  async tipo => {
    await act(async () => {
      await accion('Detectar PID compatibles').props.onPress();
    });
    await act(async () => {
      if (tipo === 'bluetooth') {
        mockEstado('PoweredOff');
      } else {
        mockDesconexion();
      }
    });
    expect(panel().props.deteccion).toBeNull();
  },
);

test('una respuesta tardia no repone los botones despues de desconectar', async () => {
  let resolver!: (valor: Awaited<ReturnType<typeof mockEnviar>>) => void;
  mockEnviar.mockImplementationOnce(
    () =>
      new Promise(res => {
        resolver = res;
      }),
  );
  let final!: Promise<void>;
  await act(async () => {
    final = accion('Detectar PID compatibles').props.onPress();
  });
  await act(async () => {
    mockDesconexion();
  });
  await act(async () => {
    resolver({
      textoAscii: '41 00 08 10 00 00\r>',
      bytes: [],
      metricasRecepcion: {
        inicioComandoMs: 0,
        escrituraBleCompletaMs: 1,
        primerFragmentoMs: 2,
        respuestaCompletaMs: 3,
        cantidadFragmentos: 1,
        cantidadBytes: 8,
      },
    });
    await final;
  });
  expect(panel().props.deteccion).toBeNull();
});
