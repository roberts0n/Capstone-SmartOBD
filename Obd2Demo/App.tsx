import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PantallaEscanerObd } from './src/pantallas/PantallaEscanerObd';
import { Login } from './src/pantallas/login';
import { Inicio } from './src/pantallas/inicio';
import { Registro } from './src/pantallas/registro';
import { ActivarCuenta } from './src/pantallas/activarCuenta';
import {
  cerrarSesionTaller,
  iniciarSesionTaller,
  recuperarSesionTaller,
} from './src/servicios/autenticacionTaller';
import { invitarPersonalTaller } from './src/servicios/personalTaller';
import {
  activarCuentaInvitada,
  prepararActivacionDesdeEnlace,
  validarCodigoInvitacion,
} from './src/servicios/activacionCuenta';
import type { SesionTaller } from './src/tipos/usuarioTaller';

type Ruta = 'login' | 'activar-cuenta' | 'inicio' | 'registro' | 'escaner';

// Punto de entrada visual. La logica BLE y OBD vive fuera de App para mantener
// este componente limitado a configurar el area segura y la barra de estado.
function Aplicacion() {
  const [ruta, establecerRuta] = useState<Ruta>('login');
  const [sesion, establecerSesion] = useState<SesionTaller | null>(null);
  const [inicializando, establecerInicializando] = useState(true);
  const [mensajeSistema, establecerMensajeSistema] = useState<string | null>(
    null,
  );
  const [invitacionPreparada, establecerInvitacionPreparada] = useState(false);

  useEffect(() => {
    let activa = true;
    async function abrirInvitacion(url: string): Promise<boolean> {
      try {
        const esInvitacion = await prepararActivacionDesdeEnlace(url);
        if (activa && esInvitacion) {
          establecerMensajeSistema(null);
          establecerInvitacionPreparada(true);
          establecerRuta('activar-cuenta');
        }
        return esInvitacion;
      } catch (capturado) {
        if (activa) {
          establecerMensajeSistema(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudo abrir la invitacion.',
          );
          establecerRuta('login');
        }
        return true;
      }
    }

    async function inicializar() {
      try {
        const enlaceInicial = await Linking.getInitialURL();
        if (enlaceInicial && (await abrirInvitacion(enlaceInicial))) {
          return;
        }

        const sesionRecuperada = await recuperarSesionTaller();
        if (activa && sesionRecuperada) {
          establecerSesion(sesionRecuperada);
          establecerRuta('inicio');
        }
      } catch (capturado) {
        if (activa) {
          establecerMensajeSistema(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudo recuperar la sesion.',
          );
        }
      } finally {
        if (activa) establecerInicializando(false);
      }
    }

    inicializar().catch(() => undefined);
    const suscripcion = Linking.addEventListener('url', evento => {
      abrirInvitacion(evento.url).catch(() => undefined);
    });

    return () => {
      activa = false;
      suscripcion.remove();
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

  async function completarActivacion(contrasena: string) {
    const siguienteSesion = await activarCuentaInvitada(contrasena);
    establecerSesion(siguienteSesion);
    establecerMensajeSistema(null);
    establecerRuta('inicio');
    return siguienteSesion;
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
          <Login
            alIngresar={ingresar}
            alAbrirInvitacion={() => {
              establecerInvitacionPreparada(false);
              establecerRuta('activar-cuenta');
            }}
            mensajeSistema={mensajeSistema}
          />
        )}
        {!inicializando && ruta === 'activar-cuenta' && (
          <ActivarCuenta
            sesionPreparada={invitacionPreparada}
            alValidarCodigo={validarCodigoInvitacion}
            alActivar={completarActivacion}
          />
        )}
        {!inicializando && ruta === 'inicio' && sesion && (
          <Inicio
            sesion={sesion}
            alAbrirEscaner={() => establecerRuta('escaner')}
            alAbrirRegistro={() => establecerRuta('registro')}
            alCerrarSesion={cerrarSesion}
          />
        )}
        {!inicializando &&
          ruta === 'registro' &&
          sesion?.perfil === 'administrador' && (
            <Registro
              alInvitar={invitarPersonalTaller}
              alVolver={() => establecerRuta('inicio')}
            />
          )}
        {ruta === 'escaner' && sesion && <PantallaEscanerObd />}
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
