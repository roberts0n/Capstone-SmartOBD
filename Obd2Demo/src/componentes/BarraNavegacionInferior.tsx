import { useEstilosTematicos } from '../tema/tokensTema';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PerfilTaller } from '../tipos/usuarioTaller';

export type DestinoBarra = 'inicio' | 'herramientas' | 'registro' | 'cuenta';

interface Propiedades {
  perfil: PerfilTaller;
  destinoActivo: DestinoBarra;
  alNavegar: (destino: DestinoBarra) => void;
}

interface Opcion {
  destino: DestinoBarra;
  etiqueta: string;
  icono: string;
}

const OPCIONES_POR_PERFIL: Record<PerfilTaller, Opcion[]> = {
  administrador: [
    { destino: 'inicio', etiqueta: 'Inicio', icono: '⌂' },
    { destino: 'registro', etiqueta: 'Personal', icono: 'USR' },
    { destino: 'cuenta', etiqueta: 'Cuenta', icono: '●' },
  ],
  recepcion: [
    { destino: 'inicio', etiqueta: 'Inicio', icono: '⌂' },
    { destino: 'herramientas', etiqueta: 'Recepción', icono: 'RX' },
    { destino: 'cuenta', etiqueta: 'Cuenta', icono: '●' },
  ],
  mecanico: [
    { destino: 'inicio', etiqueta: 'Inicio', icono: '⌂' },
    { destino: 'herramientas', etiqueta: 'Trabajo', icono: 'OT' },
    { destino: 'cuenta', etiqueta: 'Cuenta', icono: '●' },
  ],
};

export function BarraNavegacionInferior({
  perfil,
  destinoActivo,
  alNavegar,
}: Propiedades) {
  const estilos = useEstilosTematicos(estilosBase);
  return (
    <View accessibilityRole="tablist" style={estilos.barra}>
      {OPCIONES_POR_PERFIL[perfil].map(opcion => {
        const activa = opcion.destino === destinoActivo;
        return (
          <Pressable
            accessibilityLabel={opcion.etiqueta}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            key={opcion.destino}
            onPress={() => alNavegar(opcion.destino)}
            style={({ pressed }) => [
              estilos.opcion,
              activa && estilos.opcionActiva,
              pressed && estilos.presionada,
            ]}
          >
            <View style={[estilos.icono, activa && estilos.iconoActivo]}>
              <Text style={[estilos.textoIcono, activa && estilos.textoActivo]}>
                {opcion.icono}
              </Text>
            </View>
            <Text style={[estilos.etiqueta, activa && estilos.textoActivo]}>
              {opcion.etiqueta}
            </Text>
            {activa ? <View style={estilos.indicador} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const estilosBase = StyleSheet.create({
  barra: {
    minHeight: 70,
    flexDirection: 'row',
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#2A2A2E',
    borderRadius: 22,
    marginHorizontal: 18,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 5,
    shadowColor: '#09090B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  opcion: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 16,
  },
  opcionActiva: { backgroundColor: '#287FFF' },
  presionada: { opacity: 0.65 },
  icono: {
    minWidth: 29,
    height: 25,
    paddingHorizontal: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoActivo: { backgroundColor: 'transparent' },
  textoIcono: {
    color: '#85858C',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  etiqueta: { color: '#85858C', fontSize: 10, fontWeight: '600', marginTop: 3 },
  textoActivo: { color: '#FEFEFE' },
  indicador: {
    position: 'absolute',
    bottom: -5,
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
});
