import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PantallaEscanerObd } from './src/pantallas/PantallaEscanerObd';
import { Login } from './src/pantallas/login';
import { Inicio } from './src/pantallas/inicio';
import {
  cerrarSesionTaller,
  iniciarSesionTaller,
  recuperarSesionTaller,
} from './src/servicios/autenticacionTaller';
import type { SesionTaller } from './src/tipos/usuarioTaller';

type Ruta = 'login' | 'inicio' | 'escaner';

// Punto de entrada visual. La logica BLE y OBD vive fuera de App para mantener
// este componente limitado a configurar el area segura y la barra de estado.
function Aplicacion() {
  const [ruta, establecerRuta] = useState<Ruta>('login');
  const [sesion, establecerSesion] = useState<SesionTaller | null>(null);
  const [inicializando, establecerInicializando] = useState(true);
  const [mensajeSistema, establecerMensajeSistema] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let activa = true;
    recuperarSesionTaller()
      .then(sesionRecuperada => {
        if (!activa || !sesionRecuperada) {
          return;
        }
        establecerSesion(sesionRecuperada);
        establecerRuta('inicio');
      })
      .catch(capturado => {
        if (activa) {
          establecerMensajeSistema(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudo recuperar la sesion.',
          );
        }
      })
      .finally(() => {
        if (activa) {
          establecerInicializando(false);
        }
      });

    return () => {
      activa = false;
    };
  }, []);

  async function ingresar(correo: string, contrasena: string) {
    const siguienteSesion = await iniciarSesionTaller(correo, contrasena);
    establecerSesion(siguienteSesion);
    establecerMensajeSistema(null);
    establecerRuta('inicio');
  }

  async function cerrarSesion() {
    await cerrarSesionTaller();
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
        {inicializando && (
          <View style={estilos.cargando}>
            <ActivityIndicator color="#10A37F" size="large" />
            <Text style={estilos.textoCargando}>Recuperando sesion...</Text>
          </View>
        )}
        {!inicializando && ruta === 'login' && (
          <Login alIngresar={ingresar} mensajeSistema={mensajeSistema} />
        )}
        {!inicializando && ruta === 'inicio' && sesion && (
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
  cargando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  textoCargando: { color: '#A1A1AA', fontSize: 13 },
});

export default Aplicacion;
