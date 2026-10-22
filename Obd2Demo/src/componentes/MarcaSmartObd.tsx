import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useEstilosTematicos } from '../tema/tokensTema';

export function MarcaSmartObd() {
  const estilos = useEstilosTematicos(estilosBase);
  return (
    <View
      accessibilityLabel="SmartOBD para talleres"
      accessibilityRole="header"
      style={estilos.marca}
    >
      <View style={estilos.logo}>
        <View style={estilos.arcoLogo} />
        <View style={estilos.agujaLogo} />
        <View style={estilos.baseLogo} />
      </View>
      <View>
        <Text style={estilos.nombreMarca}>
          Smart<Text style={estilos.nombreMarcaAzul}>OBD</Text>
        </Text>
        <Text style={estilos.bajadaMarca}>PARA TALLERES</Text>
      </View>
    </View>
  );
}

const estilosBase = StyleSheet.create({
    marca: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    logo: {
      width: 39,
      height: 39,
      borderRadius: 13,
      backgroundColor: '#071329',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    arcoLogo: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.7,
      borderColor: '#287FFF',
      borderBottomColor: 'transparent',
      transform: [{ rotate: '-18deg' }],
    },
    agujaLogo: {
      position: 'absolute',
      width: 8,
      height: 2,
      borderRadius: 2,
      backgroundColor: '#287FFF',
      transform: [{ rotate: '-52deg' }, { translateX: 2 }],
    },
    baseLogo: {
      position: 'absolute',
      bottom: 0,
      width: 23,
      height: 3,
      borderRadius: 3,
      backgroundColor: '#287FFF',
    },
    nombreMarca: {
      color: '#F4F4F5',
      fontSize: 15,
      fontWeight: '800',
      marginLeft: 11,
    },
    nombreMarcaAzul: { color: '#287FFF' },
    bajadaMarca: {
      color: '#85858C',
      fontSize: 7,
      fontWeight: '700',
      letterSpacing: 2.5,
      marginLeft: 11,
      marginTop: 2,
    },
  });

export default MarcaSmartObd;
