import React, { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PantallaEscanerObd } from './src/pantallas/PantallaEscanerObd';
import { Login } from './src/pantallas/login';
import { Inicio } from './src/pantallas/inicio';
import type { SesionTaller } from './src/tipos/usuarioTaller';

type Ruta = 'login' | 'inicio' | 'escaner';

// Punto de entrada visual. La logica BLE y OBD vive fuera de App para mantener
// este componente limitado a configurar el area segura y la barra de estado.
function Aplicacion() {
  const [ruta, establecerRuta] = useState<Ruta>('login');
  const [sesion, establecerSesion] = useState<SesionTaller | null>(null);

  function ingresar(siguienteSesion: SesionTaller) {
    establecerSesion(siguienteSesion);
    establecerRuta('inicio');
  }

  function cerrarSesion() {
    establecerSesion(null);
    establecerRuta('login');
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0E" />
      <SafeAreaView
        style={estilos.contenedor}
        edges={['top', 'right', 'bottom', 'left']}
      >
        {ruta === 'login' && (
          <Login alIngresar={ingresar} />
        )}
        {ruta === 'inicio' && sesion && (
          <Inicio
            sesion={sesion}
            alAbrirEscaner={() => establecerRuta('escaner')}
            alCerrarSesion={cerrarSesion}
          />
        )}
        {ruta === 'escaner' && <PantallaEscanerObd />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#0D0D0E' },
});

export default Aplicacion;
