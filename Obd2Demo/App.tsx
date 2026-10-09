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
import { NuevaOrdenTrabajo } from './src/pantallas/nuevaOrdenTrabajo';
import { RegistrarCliente } from './src/pantallas/registrarCliente';
import { RegistrarVehiculo } from './src/pantallas/registrarVehiculo';
import { CasosRecepcion } from './src/pantallas/casosRecepcion';
import { DetalleCasoRecepcion } from './src/pantallas/detalleCasoRecepcion';
import type { CasoRecepcion } from './src/casos/ServicioCasosRecepcion';
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
import {
  ProveedorEscanerObd,
  useSesionEscanerObd,
} from './src/escaner/ContextoEscanerObd';

type Ruta =
  | DestinoBarra
  | 'login'
  | 'nueva_orden'
  | 'registrar_cliente'
  | 'registrar_vehiculo'
  | 'casos_recepcion'
  | 'detalle_caso_recepcion';

// Punto de entrada visual. La logica BLE y OBD vive fuera de App para mantener
// este componente limitado a configurar el area segura y la barra de estado.
function ContenidoAplicacion() {
  const sesionEscaner = useSesionEscanerObd();
  const [ruta, establecerRuta] = useState<Ruta>('login');
  const [sesion, establecerSesion] = useState<SesionTaller | null>(null);
  const [casoRecepcion, establecerCasoRecepcion] =
    useState<CasoRecepcion | null>(null);
  const [clienteInicialVehiculoId, establecerClienteInicialVehiculoId] =
    useState<string | null>(null);
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
    // al salir cierro tambien el enlace con el auto para no dejar una sesion ajena activa
    await sesionEscaner.desconectar().catch(() => undefined);
    await cerrarSesionTaller();
    establecerSesion(null);
    establecerCasoRecepcion(null);
    establecerClienteInicialVehiculoId(null);
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
    establecerCasoRecepcion(null);
    establecerClienteInicialVehiculoId(null);
    establecerRuta(destino);
  }

  const mostrarBarra =
    !inicializando && Boolean(sesion) && !sesion?.debeCambiarPassword;
  const destinoActivo: DestinoBarra =
    ruta === 'nueva_orden' ||
    ruta === 'registrar_cliente' ||
    ruta === 'registrar_vehiculo' ||
    ruta === 'casos_recepcion' ||
    ruta === 'detalle_caso_recepcion'
      ? 'herramientas'
      : ruta === 'login'
        ? 'inicio'
        : ruta;

  return (
    <>
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
            alAbrirNuevaOrden={() => establecerRuta('nueva_orden')}
            alAbrirCasosRecepcion={() => establecerRuta('casos_recepcion')}
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
              alAbrirNuevaOrden={() => establecerRuta('nueva_orden')}
              alAbrirRegistroCliente={() => establecerRuta('registrar_cliente')}
              alAbrirRegistroVehiculo={() => {
                establecerClienteInicialVehiculoId(null);
                establecerRuta('registrar_vehiculo');
              }}
              alAbrirCasosRecepcion={() => establecerRuta('casos_recepcion')}
            />
          )}
        {!inicializando &&
          ruta === 'nueva_orden' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <NuevaOrdenTrabajo
              sesion={sesion}
              alVolver={() => establecerRuta('herramientas')}
              alCasoCreado={caso => {
                establecerCasoRecepcion(caso);
                establecerRuta('detalle_caso_recepcion');
              }}
            />
          )}
        {!inicializando &&
          ruta === 'registrar_cliente' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <RegistrarCliente
              sesion={sesion}
              alAgregarVehiculo={clienteId => {
                establecerClienteInicialVehiculoId(clienteId);
                establecerRuta('registrar_vehiculo');
              }}
              alFinalizar={() => establecerRuta('herramientas')}
              alVolver={() => establecerRuta('herramientas')}
            />
          )}
        {!inicializando &&
          ruta === 'registrar_vehiculo' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <RegistrarVehiculo
              sesion={sesion}
              clienteInicialId={clienteInicialVehiculoId}
              alFinalizar={() => {
                establecerClienteInicialVehiculoId(null);
                establecerRuta('herramientas');
              }}
              alVolver={() => {
                establecerClienteInicialVehiculoId(null);
                establecerRuta('herramientas');
              }}
            />
          )}
        {!inicializando &&
          ruta === 'casos_recepcion' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <CasosRecepcion
              alAbrirCaso={caso => {
                establecerCasoRecepcion(caso);
                establecerRuta('detalle_caso_recepcion');
              }}
              alVolver={() => establecerRuta('herramientas')}
            />
          )}
        {!inicializando &&
          ruta === 'detalle_caso_recepcion' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword &&
          casoRecepcion && (
            <DetalleCasoRecepcion
              caso={casoRecepcion}
              sesion={sesion}
              alAbrirEscaner={() => establecerRuta('escaner')}
              alActualizarCaso={establecerCasoRecepcion}
              alVolver={() => {
                establecerCasoRecepcion(null);
                establecerRuta('casos_recepcion');
              }}
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
          !sesion.debeCambiarPassword && (
            <PantallaEscanerObd
              alVolver={casoRecepcion
                ? () => establecerRuta('detalle_caso_recepcion')
                : undefined}
            />
          )}
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
    </>
  );
}

// mantengo una sola sesion del escaner mientras el trabajador recorre la app
function Aplicacion() {
  return (
    <SafeAreaProvider>
      <ProveedorEscanerObd>
        <ContenidoAplicacion />
      </ProveedorEscanerObd>
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
