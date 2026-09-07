import React, { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PantallaEscanerObd } from './src/pantallas/PantallaEscanerObd';
import { Login } from './src/pantallas/login';
import { Inicio } from './src/pantallas/inicio';

type Ruta = 'login' | 'inicio' | 'escaner';

// Punto de entrada visual. La logica BLE y OBD vive fuera de App para mantener
// este componente limitado a configurar el area segura y la barra de estado.
function Aplicacion() {
  const [ruta, establecerRuta] = useState<Ruta>('login');
  const [nombreUsuario, establecerNombreUsuario] = useState('Conductor');

  function ingresar(correo: string) {
    const nombre = correo.split('@')[0].trim();
    establecerNombreUsuario(nombre || 'Conductor');
    establecerRuta('inicio');
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0E" />
      <SafeAreaView
        style={estilos.contenedor}
        edges={['top', 'right', 'bottom', 'left']}
      >
        {ruta === 'login' && (
          <Login
            alIngresar={ingresar}
            alContinuarComoInvitado={() => {
              establecerNombreUsuario('Invitado');
              establecerRuta('inicio');
            }}
          />
        )}
        {ruta === 'inicio' && (
          <Inicio
            nombreUsuario={nombreUsuario}
            alAbrirEscaner={() => establecerRuta('escaner')}
            alCerrarSesion={() => establecerRuta('login')}
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
