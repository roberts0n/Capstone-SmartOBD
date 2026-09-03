import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PanelPidsCompatibles } from '../src/componentes/PanelPidsCompatibles';
import { useCatalogoVehiculo } from '../src/obd/mode01/usarCatalogoVehiculo';
import {
  consolidarDeteccionPids,
  interpretarBloquePids,
} from '../src/obd/DeteccionPids';

jest.setTimeout(30000);
// El preset nativo envuelve Pressable. Se buscan roles accesibles y se deduplican
// las envolturas por etiqueta, igual que los botones visibles para el usuario.
const botones = (vista: TestRenderer.ReactTestRenderer) => [
  ...new Map(
    vista.root
      .findAllByProps({ accessibilityRole: 'button' })
      .filter(nodo => typeof nodo.props.onPress === 'function')
      .map(nodo => [nodo.props.accessibilityLabel, nodo]),
  ).values(),
];
const deteccionA = consolidarDeteccionPids([
  interpretarBloquePids('0100', '41 00 08 10 00 00'),
]);
const deteccionB = consolidarDeteccionPids([
  interpretarBloquePids('0140', '41 40 04 00 00 00'),
]);

test('botones por compatibilidad, sin RPM fijo, sin consultas al renderizar y con bloqueo', async () => {
  const consultar = jest.fn();
  let vista!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    vista = TestRenderer.create(
      <PanelPidsCompatibles
        deteccion={null}
        deshabilitado={false}
        alConsultar={consultar}
      />,
    );
  });
  expect(botones(vista)).toHaveLength(0);
  await act(async () => {
    vista.update(
      <PanelPidsCompatibles
        deteccion={deteccionA}
        deshabilitado={false}
        alConsultar={consultar}
      />,
    );
  });
  expect(botones(vista).map(b => b.props.accessibilityLabel)).toEqual(
    expect.arrayContaining([
      'RPM del motor · 010C',
      'Temperatura del refrigerante · 0105',
    ]),
  );
  expect(botones(vista)).toHaveLength(2);
  expect(consultar).not.toHaveBeenCalled();
  await act(async () => {
    botones(vista)[0].props.onPress();
  });
  expect(consultar).toHaveBeenCalledTimes(1);
  await act(async () => {
    vista.update(
      <PanelPidsCompatibles
        deteccion={deteccionB}
        deshabilitado
        alConsultar={consultar}
      />,
    );
  });
  expect(botones(vista)).toHaveLength(1);
  expect(botones(vista)[0].props.accessibilityLabel).toBe(
    'Temperatura ambiente · 0146',
  );
  await act(async () => {
    botones(vista)[0].props.onPress();
  });
  expect(consultar).toHaveBeenCalledTimes(1);
  await act(async () => {
    vista.unmount();
  });
});

test('lista PID pendientes sin crear botones de comandos no implementados', async () => {
  const deteccion = consolidarDeteccionPids([
    interpretarBloquePids('0160', '41 60 80 00 00 00'),
  ]);
  let vista!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    vista = TestRenderer.create(
      <PanelPidsCompatibles
        deteccion={deteccion}
        deshabilitado={false}
        alConsultar={jest.fn()}
      />,
    );
  });
  expect(botones(vista)).toHaveLength(0);
  expect(JSON.stringify(vista.toJSON())).toContain('0161');
  expect(JSON.stringify(vista.toJSON())).toContain(
    'pendientes de interpretación',
  );
  await act(async () => {
    vista.unmount();
  });
});

test('limpieza de sesion elimina botones y configuracion, una nueva deteccion no hereda escalas', async () => {
  let catalogo!: ReturnType<typeof useCatalogoVehiculo>;
  function Prueba() {
    catalogo = useCatalogoVehiculo();
    return (
      <PanelPidsCompatibles
        deteccion={catalogo.deteccion}
        deshabilitado={false}
        alConsultar={jest.fn()}
      />
    );
  }
  let vista!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    vista = TestRenderer.create(<Prueba />);
  });
  await act(async () => {
    catalogo.establecer(deteccionA, { '014F': '41 4F 04 10 40 4D' });
  });
  expect(botones(vista)).toHaveLength(2);
  await act(async () => {
    catalogo.limpiar();
  });
  expect(catalogo.contexto.current).toBeUndefined();
  expect(botones(vista)).toHaveLength(0);
  await act(async () => {
    catalogo.establecer(deteccionB, {});
  });
  expect(catalogo.contexto.current?.respuestasConfiguracion).toEqual({});
  expect(botones(vista)).toHaveLength(1);
  await act(async () => {
    vista.unmount();
  });
});
