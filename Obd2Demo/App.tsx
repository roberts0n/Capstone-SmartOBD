import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { CambiarContrasena } from './src/pantallas/cambiarContrasena';
import { HerramientasRol } from './src/pantallas/herramientasRol';
import { Cuenta } from './src/pantallas/cuenta';
import {
  BarraNavegacionInferior,
  type DestinoBarra,
} from './src/componentes/BarraNavegacionInferior';
import {
  cerrarSesionTaller,
  iniciarSesionTaller,
  recuperarSesionTaller,
} from './src/servicios/autenticacionTaller';
import { registrarPersonalTaller } from './src/servicios/personalTaller';
import { cambiarContrasenaInicial } from './src/servicios/cambioContrasena';
import type { SesionTaller } from './src/tipos/usuarioTaller';

type Ruta = DestinoBarra | 'login';

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
    async function inicializar() {
      try {
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

  async function completarCambio(contrasena: string) {
    const siguienteSesion = await cambiarContrasenaInicial(contrasena);
    establecerSesion(siguienteSesion);
    establecerMensajeSistema(null);
    establecerRuta('inicio');
    return siguienteSesion;
  }

  function navegar(destino: DestinoBarra) {
    if (!sesion || sesion.debeCambiarPassword) return;
    if (destino === 'registro' && sesion.perfil !== 'administrador') return;
    if (destino === 'herramientas' && sesion.perfil === 'administrador') return;
    establecerRuta(destino);
  }

  const mostrarBarra =
    !inicializando && Boolean(sesion) && !sesion?.debeCambiarPassword;
  const destinoActivo: DestinoBarra = ruta === 'login' ? 'inicio' : ruta;

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
        {!inicializando && !sesion && (
          <Login
            alIngresar={ingresar}
            mensajeSistema={mensajeSistema}
          />
        )}
        {!inicializando && sesion?.debeCambiarPassword && (
          <CambiarContrasena
            alCambiar={completarCambio}
            alCerrarSesion={cerrarSesion}
          />
        )}
        {!inicializando && !sesion?.debeCambiarPassword && ruta === 'inicio' && sesion && (
          <Inicio
            sesion={sesion}
            alAbrirEscaner={() => establecerRuta('escaner')}
            alAbrirRegistro={() => establecerRuta('registro')}
            alAbrirCuenta={() => establecerRuta('cuenta')}
          />
        )}
        {!inicializando &&
          ruta === 'herramientas' &&
          sesion &&
          !sesion.debeCambiarPassword &&
          sesion.perfil !== 'administrador' && (
            <HerramientasRol
              sesion={sesion}
              alAbrirEscaner={() => establecerRuta('escaner')}
            />
          )}
        {!inicializando &&
          ruta === 'registro' &&
          !sesion?.debeCambiarPassword &&
          sesion?.perfil === 'administrador' && (
            <Registro
              alRegistrar={registrarPersonalTaller}
              alVolver={() => establecerRuta('inicio')}
            />
          )}
        {!inicializando && ruta === 'escaner' && sesion &&
          !sesion.debeCambiarPassword && <PantallaEscanerObd />}
        {!inicializando && ruta === 'cuenta' && sesion &&
          !sesion.debeCambiarPassword && (
            <Cuenta sesion={sesion} alCerrarSesion={cerrarSesion} />
          )}
        {mostrarBarra && sesion ? (
          <BarraNavegacionInferior
            perfil={sesion.perfil}
            destinoActivo={destinoActivo}
            alNavegar={navegar}
          />
        ) : null}
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
