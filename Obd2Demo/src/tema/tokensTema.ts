import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

export type ModoTema = 'claro' | 'oscuro';

export interface ColoresTema {
  fondo: string;
  superficie: string;
  superficieElevada: string;
  campo: string;
  primario: string;
  seleccion: string;
  texto: string;
  textoSecundario: string;
  borde: string;
  navegacion: string;
  exito: string;
  advertencia: string;
  error: string;
}

export const TEMAS: Record<ModoTema, ColoresTema> = {
  claro: {
    fondo: '#F4F7FB',
    superficie: '#FFFFFF',
    superficieElevada: '#FFFFFF',
    campo: '#F3F6FB',
    primario: '#287FFF',
    seleccion: '#D8EEFF',
    texto: '#101A2E',
    textoSecundario: '#63718A',
    borde: '#D4DFED',
    navegacion: '#FFFFFF',
    exito: '#26945B',
    advertencia: '#B76E00',
    error: '#D9303E',
  },
  oscuro: {
    fondo: '#10192D',
    superficie: '#202C42',
    superficieElevada: '#202C42',
    campo: '#10192D',
    primario: '#3488FF',
    seleccion: '#153A62',
    texto: '#FFFFFF',
    textoSecundario: '#9CB0CE',
    borde: '#344158',
    navegacion: '#202C42',
    exito: '#4ED88A',
    advertencia: '#F4B860',
    error: '#FF746F',
  },
};

let modoTemaActual: ModoTema = 'claro';

export function establecerModoTemaActual(modo: ModoTema): void {
  modoTemaActual = modo;
}

type EstiloNombrado = ViewStyle | TextStyle | ImageStyle;
type HojaEstilos = Record<string, EstiloNombrado>;
const PROPIEDADES_COLOR = new Set([
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'color',
  'shadowColor',
  'textDecorationColor',
]);

/** Aplica la paleta vigente a las hojas existentes sin duplicar pantallas. */
export function crearEstilosTematicos<T extends HojaEstilos>(estilos: T): T {
  const adaptados: HojaEstilos = {};
  Object.entries(estilos).forEach(([nombre, estilo]) => {
    const siguiente = { ...estilo } as EstiloNombrado;
    Object.entries(estilo).forEach(([propiedad, valor]) => {
      if (!PROPIEDADES_COLOR.has(propiedad) || typeof valor !== 'string')
        return;
      Object.defineProperty(siguiente, propiedad, {
        enumerable: true,
        configurable: true,
        get: () => resolverColor(valor, propiedad, modoTemaActual),
      });
    });
    adaptados[nombre] = siguiente;
  });
  return adaptados as T;
}

function resolverColor(
  original: string,
  propiedad: string,
  modo: ModoTema,
): string {
  const tema = TEMAS[modo];
  const color = original.toUpperCase();
  if (esSemantico(color)) return original;
  if (esAcento(color)) return tema.primario;
  if (propiedad === 'color' || propiedad === 'textDecorationColor') {
    if (esTextoPrincipal(color)) return tema.texto;
    if (esTextoSecundario(color)) return tema.textoSecundario;
  }
  if (propiedad.includes('border') || propiedad === 'shadowColor') {
    if (esBordeAcento(color)) return tema.primario;
    if (esBorde(color)) return tema.borde;
  }
  if (propiedad === 'backgroundColor') {
    if (esSeleccion(color)) return tema.seleccion;
    if (esCampo(color)) return tema.campo;
    if (esFondo(color)) return tema.fondo;
    if (esSuperficie(color)) return tema.superficie;
  }
  return original;
}

function estaEn(color: string, colores: readonly string[]): boolean {
  return colores.includes(color);
}
function esAcento(color: string): boolean {
  return estaEn(color, [
    '#10A37F',
    '#13C296',
    '#5BE0BB',
    '#4DDBB7',
    '#58A6FF',
    '#21CFA3',
    '#66DFBD',
    '#75E4C5',
    '#75E6C6',
    '#76E4C5',
    '#6EE7C3',
    '#81E2C5',
  ]);
}
function esSemantico(color: string): boolean {
  return [
    'FF9C94',
    'FF8A80',
    'FFB4AB',
    'FF6B63',
    'F4B860',
    'E5C087',
    'E7B977',
    'FDE68A',
    'A7F3D0',
  ].some(valor => color.includes(valor));
}
function esTextoPrincipal(color: string): boolean {
  return estaEn(color, [
    '#FFFFFF',
    '#FFF',
    '#F5F5F6',
    '#F4F4F5',
    '#F1F1F3',
    '#F0F0F2',
    '#EDEDEF',
    '#ECECEE',
    '#E8E8EA',
    '#E7E7EA',
    '#E6E6EA',
    '#E4E4E7',
    '#D9E2EC',
    '#D7E8E2',
    '#D4D4D8',
    '#CFFFF2',
    '#C7D8D2',
    '#B8F3E3',
  ]);
}
function esTextoSecundario(color: string): boolean {
  return estaEn(color, [
    '#C7C7CC',
    '#B8B8BE',
    '#A7C8BE',
    '#A1A1AA',
    '#96969D',
    '#94A39E',
    '#929299',
    '#8F8F97',
    '#8C8C94',
    '#898990',
    '#85858C',
    '#7F7F87',
    '#77777F',
    '#77777E',
    '#71717A',
    '#68686F',
    '#64748B',
    '#9A9AA1',
  ]);
}
function esFondo(color: string): boolean {
  return estaEn(color, ['#0D0D0E', '#09090B']);
}
function esCampo(color: string): boolean {
  return estaEn(color, ['#101011', '#0B0B0D', '#111113']);
}
function esSuperficie(color: string): boolean {
  return estaEn(color, [
    '#121214',
    '#171719',
    '#18181A',
    '#1B1B1E',
    '#1C1C1F',
    '#1D1D20',
    '#202023',
    '#242427',
    '#252529',
    '#27272B',
    '#28282C',
    '#29292D',
  ]);
}
function esSeleccion(color: string): boolean {
  return estaEn(color, [
    '#10251F',
    '#10372D',
    '#111F1B',
    '#11241F',
    '#153B32',
    '#1C4439',
    '#1D302A',
  ]);
}
function esBorde(color: string): boolean {
  return estaEn(color, [
    '#29292D',
    '#2A2A2E',
    '#2C2C30',
    '#2D2D31',
    '#303034',
    '#343439',
    '#36363B',
    '#38383D',
    '#3A3A3E',
    '#3B3B40',
    '#3F3F46',
    '#414147',
    '#45454B',
  ]);
}
function esBordeAcento(color: string): boolean {
  return estaEn(color, ['#176B56', '#235E4E', '#285849', '#2D6B5B', '#366557']);
}
