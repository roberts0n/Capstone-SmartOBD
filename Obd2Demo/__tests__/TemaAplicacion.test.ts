import { StyleSheet } from 'react-native';
import {
  crearEstilosTematicos,
  establecerModoTemaActual,
} from '../src/tema/tokensTema';

const estilos = StyleSheet.create(
  crearEstilosTematicos({
    pantalla: { backgroundColor: '#0D0D0E' },
    tarjeta: { backgroundColor: '#171719', borderColor: '#303034' },
    titulo: { color: '#F4F4F5' },
    ayuda: { color: '#A1A1AA' },
    accion: { backgroundColor: '#10A37F' },
    error: { color: '#FF9C94' },
  }),
);

describe('tema visual de SmartOBD', () => {
  afterEach(() => establecerModoTemaActual('claro'));

  it('utiliza la paleta clara por defecto', () => {
    establecerModoTemaActual('claro');

    expect(estilos.pantalla.backgroundColor).toBe('#F4F7FB');
    expect(estilos.tarjeta.backgroundColor).toBe('#FFFFFF');
    expect(estilos.tarjeta.borderColor).toBe('#D4DFED');
    expect(estilos.titulo.color).toBe('#101A2E');
    expect(estilos.ayuda.color).toBe('#63718A');
    expect(estilos.accion.backgroundColor).toBe('#287FFF');
  });

  it('cambia la misma interfaz a la paleta oscura', () => {
    establecerModoTemaActual('oscuro');

    expect(estilos.pantalla.backgroundColor).toBe('#10192D');
    expect(estilos.tarjeta.backgroundColor).toBe('#202C42');
    expect(estilos.tarjeta.borderColor).toBe('#344158');
    expect(estilos.titulo.color).toBe('#FFFFFF');
    expect(estilos.ayuda.color).toBe('#9CB0CE');
    expect(estilos.accion.backgroundColor).toBe('#3488FF');
  });

  it('conserva los colores semanticos de error', () => {
    establecerModoTemaActual('oscuro');
    expect(estilos.error.color).toBe('#FF9C94');
  });
});
