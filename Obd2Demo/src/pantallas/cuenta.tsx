import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alCerrarSesion: () => Promise<void>;
}

const NOMBRES_ROL = {
  administrador: 'Administrador',
  recepcion: 'Recepción',
  mecanico: 'Mecánico',
};

export function Cuenta({ sesion, alCerrarSesion }: Propiedades) {
  return (
    <View style={estilos.pantalla}>
      <View style={estilos.avatar}>
        <Text style={estilos.inicial}>{sesion.nombre.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={estilos.nombre}>{sesion.nombre}</Text>
      <Text style={estilos.correo}>{sesion.correo}</Text>

      <View style={estilos.tarjeta}>
        <Dato etiqueta="Rol" valor={NOMBRES_ROL[sesion.perfil]} />
        <View style={estilos.separador} />
        <Dato etiqueta="Taller" valor={sesion.taller} />
        <View style={estilos.separador} />
        <Dato etiqueta="Estado" valor="Cuenta activa" destacado />
      </View>

      <Pressable accessibilityRole="button" onPress={alCerrarSesion} style={estilos.boton}>
        <Text style={estilos.textoBoton}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

function Dato({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <View style={estilos.dato}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text style={[estilos.valor, destacado && estilos.valorDestacado]}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E', paddingHorizontal: 20, paddingTop: 34 },
  avatar: { width: 76, height: 76, borderRadius: 25, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: '#153B32', borderWidth: 1, borderColor: '#2D6B5B' },
  inicial: { color: '#6EE7C3', fontSize: 29, fontWeight: '800' },
  nombre: { color: '#F4F4F5', fontSize: 24, fontWeight: '700', textAlign: 'center', marginTop: 15 },
  correo: { color: '#8F8F97', fontSize: 13, textAlign: 'center', marginTop: 5 },
  tarjeta: { backgroundColor: '#171719', borderWidth: 1, borderColor: '#303034', borderRadius: 18, paddingHorizontal: 16, marginTop: 30 },
  dato: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 },
  etiqueta: { color: '#85858C', fontSize: 12 },
  valor: { flex: 1, color: '#E7E7EA', fontSize: 13, fontWeight: '600', textAlign: 'right' },
  valorDestacado: { color: '#5BE0BB' },
  separador: { height: 1, backgroundColor: '#29292D' },
  boton: { minHeight: 51, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#5A3030', borderRadius: 13, backgroundColor: '#241616', marginTop: 20 },
  textoBoton: { color: '#FF9C94', fontSize: 14, fontWeight: '700' },
});

