import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PanelPruebaDtc } from '../src/componentes/PanelPruebaDtc';
import type { InformePruebaDtc } from '../src/obd/dtc/PruebaDtc';

// La primera carga de componentes nativos en Windows puede superar cinco segundos.
jest.setTimeout(30000);

test('panel expone iniciar y permite exportar despues de desconectar', async () => {
  const iniciar = jest.fn();
  const guardar = jest.fn();
  const informe = {
    inicio: '2026-09-02',
    estado: 'parcial',
    dispositivo: { nombre: 'OBDII' },
    capturas: [],
    advertencias: [],
    resumen: {
      cantidadCodigosUnicos: 1,
      codigosUnicos: ['P0104'],
      categorias: { '03': null, '07': null, '0A': null },
    },
  } as unknown as InformePruebaDtc;
  let renderizador!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderizador = TestRenderer.create(
      <PanelPruebaDtc
        informe={informe}
        progreso="Listo"
        notas=""
        cargando={false}
        ejecutando={false}
        guardando={false}
        deshabilitado
        error={null}
        alCambiarNotas={jest.fn()}
        alIniciar={iniciar}
        alGuardar={guardar}
        alDetener={jest.fn()}
      />,
    );
  });
  const botonInicio = renderizador.root.findAllByProps({
    accessibilityLabel: 'Leer todos los DTC',
  })[0];
  const botonGuardar = renderizador.root.findAllByProps({
    accessibilityLabel: 'Guardar informe JSON',
  })[0];
  expect(botonInicio.props.disabled).toBe(true);
  expect(botonGuardar?.props.disabled).toBe(false);
  expect(JSON.stringify(renderizador.toJSON())).toContain('Resultado JSON');
  await act(async () => {
    botonGuardar?.props.onPress();
  });
  expect(guardar).toHaveBeenCalledTimes(1);
  await act(async () => {
    renderizador.unmount();
  });
});
