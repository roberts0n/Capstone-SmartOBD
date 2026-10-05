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
import { ConectarEscaner } from './src/pantallas/conectarEscaner';
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
import { AsignarMecanico } from './src/pantallas/asignarMecanico';
import { EliminarDatosPrueba } from './src/pantallas/eliminarDatosPrueba';
import { ClientesVehiculos } from './src/pantallas/clientesVehiculos';
import { DetalleCliente } from './src/pantallas/detalleCliente';
import type { CasoRecepcion } from './src/casos/ServicioCasosRecepcion';
import {
  crearBorradorOrdenTrabajo,
  type BorradorOrdenTrabajo,
} from './src/casos/BorradorOrdenTrabajo';
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
  | 'clientes_vehiculos'
  | 'detalle_cliente'
  | 'detalle_caso_recepcion'
  | 'asignar_mecanico'
  | 'conectar_escaner'
  | 'pruebas_escaner'
  | 'eliminar_datos_prueba';

type OrigenRegistro = 'herramientas' | 'nueva_orden';
type OrigenConexion = 'inicio' | 'herramientas' | 'detalle_caso_recepcion';
type OrigenCaso = 'casos_recepcion' | 'detalle_cliente';

// dejo las pruebas disponibles en nuestras apk internas; para distribuir la app final lo cambio a false
const PRUEBAS_INTERNAS_HABILITADAS = true;

// Punto de entrada visual. La logica BLE y OBD vive fuera de App para mantener
// este componente limitado a configurar el area segura y la barra de estado.
function ContenidoAplicacion() {
  const sesionEscaner = useSesionEscanerObd();
  const [ruta, establecerRuta] = useState<Ruta>('login');
  const [origenConexion, establecerOrigenConexion] =
    useState<OrigenConexion>('inicio');
  const [sesion, establecerSesion] = useState<SesionTaller | null>(null);
  const [casoRecepcion, establecerCasoRecepcion] =
    useState<CasoRecepcion | null>(null);
  const [origenCaso, establecerOrigenCaso] =
    useState<OrigenCaso>('casos_recepcion');
  const [vehiculoConsultaId, establecerVehiculoConsultaId] = useState<
    string | null
  >(null);
  const [clienteInicialVehiculoId, establecerClienteInicialVehiculoId] =
    useState<string | null>(null);
  const [clienteConsultaId, establecerClienteConsultaId] = useState<
    string | null
  >(null);
  const [busquedaClientes, establecerBusquedaClientes] = useState('');
  const [paginaClientes, establecerPaginaClientes] = useState(0);
  const [borradorOrden, establecerBorradorOrden] = useState(
    crearBorradorOrdenTrabajo,
  );
  const [origenRegistro, establecerOrigenRegistro] =
    useState<OrigenRegistro>('herramientas');
  const [inicializando, establecerInicializando] = useState(true);
  const [limpiezaEnCurso, establecerLimpiezaEnCurso] = useState(false);
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
    establecerBorradorOrden(crearBorradorOrdenTrabajo());
    establecerOrigenRegistro('herramientas');
    establecerRuta('login');
    establecerClienteConsultaId(null);
    establecerVehiculoConsultaId(null);
    establecerOrigenCaso('casos_recepcion');
    establecerBusquedaClientes('');
    establecerPaginaClientes(0);
  }

  async function completarCambio(contrasena: string) {
    const siguienteSesion = await cambiarContrasenaInicial(contrasena);
    establecerSesion(siguienteSesion);
    establecerMensajeSistema(null);
    establecerRuta('inicio');
    return siguienteSesion;
  }

  function navegar(destino: DestinoBarra) {
    if (limpiezaEnCurso) return;
    if (!sesion || sesion.debeCambiarPassword) return;
    if (destino === 'registro' && sesion.perfil !== 'administrador') return;
    if (destino === 'herramientas' && sesion.perfil === 'administrador') return;
    establecerCasoRecepcion(null);
    establecerClienteInicialVehiculoId(null);
    establecerBorradorOrden(crearBorradorOrdenTrabajo());
    establecerOrigenRegistro('herramientas');
    establecerRuta(destino);
    establecerClienteConsultaId(null);
    establecerVehiculoConsultaId(null);
    establecerOrigenCaso('casos_recepcion');
  }

  function abrirCaso(
    caso: CasoRecepcion,
    origen: OrigenCaso = 'casos_recepcion',
  ) {
    if (sesion?.perfil !== 'recepcion' || sesion.debeCambiarPassword) return;
    establecerOrigenCaso(origen);
    establecerCasoRecepcion(caso);
    establecerRuta('detalle_caso_recepcion');
  }

  function abrirConexion(origen: OrigenConexion) {
    if (
      !sesion ||
      sesion.perfil === 'administrador' ||
      sesion.debeCambiarPassword
    )
      return;
    establecerOrigenConexion(origen);
    establecerRuta('conectar_escaner');
  }

  function volverDeConexion() {
    establecerRuta(origenConexion);
  }

  function actualizarBorrador(cambios: Partial<BorradorOrdenTrabajo>) {
    establecerBorradorOrden(actual => ({ ...actual, ...cambios }));
  }

  function volverDelRegistro() {
    establecerClienteInicialVehiculoId(null);
    establecerRuta(
      origenRegistro === 'nueva_orden' ? 'nueva_orden' : 'herramientas',
    );
    establecerOrigenRegistro('herramientas');
  }

  const mostrarBarra =
    !inicializando &&
    Boolean(sesion) &&
    !sesion?.debeCambiarPassword &&
    !limpiezaEnCurso &&
    ruta !== 'conectar_escaner';
  const destinoActivo: DestinoBarra =
    ruta === 'nueva_orden' ||
    ruta === 'registrar_cliente' ||
    ruta === 'registrar_vehiculo' ||
    ruta === 'casos_recepcion' ||
    ruta === 'clientes_vehiculos' ||
    ruta === 'detalle_cliente' ||
    ruta === 'detalle_caso_recepcion' ||
    ruta === 'asignar_mecanico' ||
    ruta === 'eliminar_datos_prueba'
      ? 'herramientas'
      : ruta === 'pruebas_escaner'
      ? 'cuenta'
      : ruta === 'conectar_escaner'
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
          <Login alIngresar={ingresar} mensajeSistema={mensajeSistema} />
        )}
        {!inicializando && sesion?.debeCambiarPassword && (
          <CambiarContrasena
            alCambiar={completarCambio}
            alCerrarSesion={cerrarSesion}
          />
        )}
        {!inicializando &&
          !sesion?.debeCambiarPassword &&
          ruta === 'inicio' &&
          sesion && (
            <Inicio
              sesion={sesion}
              alAbrirEscaner={() => abrirConexion('inicio')}
              alAbrirRegistro={() => establecerRuta('registro')}
              alAbrirRecepcion={() => navegar('herramientas')}
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
              alAbrirEscaner={() => abrirConexion('herramientas')}
              alAbrirNuevaOrden={() => {
                establecerBorradorOrden(crearBorradorOrdenTrabajo());
                establecerOrigenRegistro('herramientas');
                establecerRuta('nueva_orden');
              }}
              alAbrirRegistroCliente={() => {
                establecerOrigenRegistro('herramientas');
                establecerRuta('registrar_cliente');
              }}
              alAbrirRegistroVehiculo={() => {
                establecerClienteInicialVehiculoId(null);
                establecerOrigenRegistro('herramientas');
                establecerRuta('registrar_vehiculo');
              }}
              alAbrirCasosRecepcion={() => establecerRuta('casos_recepcion')}
              alAbrirClientesVehiculos={() => {
                if (sesion.perfil !== 'recepcion') return;
                establecerClienteConsultaId(null);
                establecerVehiculoConsultaId(null);
                establecerBusquedaClientes('');
                establecerPaginaClientes(0);
                establecerRuta('clientes_vehiculos');
              }}
              alAbrirLimpieza={() => {
                establecerCasoRecepcion(null);
                establecerBorradorOrden(crearBorradorOrdenTrabajo());
                establecerRuta('eliminar_datos_prueba');
              }}
            />
          )}
        {!inicializando &&
          ruta === 'clientes_vehiculos' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <ClientesVehiculos
              busqueda={busquedaClientes}
              pagina={paginaClientes}
              alCambiarBusqueda={texto => {
                establecerBusquedaClientes(texto);
                establecerPaginaClientes(0);
              }}
              alCambiarPagina={establecerPaginaClientes}
              alAbrirCliente={clienteId => {
                establecerClienteConsultaId(clienteId);
                establecerVehiculoConsultaId(null);
                establecerRuta('detalle_cliente');
              }}
              alVolver={() => establecerRuta('herramientas')}
            />
          )}
        {!inicializando &&
          ruta === 'detalle_cliente' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword &&
          clienteConsultaId && (
            <DetalleCliente
              key={clienteConsultaId}
              clienteId={clienteConsultaId}
              vehiculoAbiertoId={vehiculoConsultaId}
              alCambiarVehiculoAbierto={establecerVehiculoConsultaId}
              alAbrirCaso={caso => abrirCaso(caso, 'detalle_cliente')}
              alVolver={() => {
                establecerClienteConsultaId(null);
                establecerVehiculoConsultaId(null);
                establecerRuta('clientes_vehiculos');
              }}
            />
          )}
        {!inicializando &&
          ruta === 'nueva_orden' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <NuevaOrdenTrabajo
              sesion={sesion}
              borrador={borradorOrden}
              alActualizarBorrador={actualizarBorrador}
              alRegistrarCliente={() => {
                establecerOrigenRegistro('nueva_orden');
                establecerRuta('registrar_cliente');
              }}
              alRegistrarVehiculo={clienteId => {
                establecerClienteInicialVehiculoId(clienteId);
                establecerOrigenRegistro('nueva_orden');
                establecerRuta('registrar_vehiculo');
              }}
              alVolver={() => {
                establecerBorradorOrden(crearBorradorOrdenTrabajo());
                establecerRuta('herramientas');
              }}
              alCasoCreado={caso => {
                establecerBorradorOrden(crearBorradorOrdenTrabajo());
                abrirCaso(caso);
              }}
            />
          )}
        {!inicializando &&
          ruta === 'registrar_cliente' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <RegistrarCliente
              sesion={sesion}
              etiquetaFinalizar={
                origenRegistro === 'nueva_orden'
                  ? 'Volver a la orden'
                  : 'Finalizar'
              }
              alClienteRegistrado={cliente => {
                if (origenRegistro !== 'nueva_orden') return;
                actualizarBorrador({
                  busquedaCliente: cliente.nombre,
                  clienteId: cliente.id,
                  vehiculoId: null,
                });
              }}
              alAgregarVehiculo={clienteId => {
                establecerClienteInicialVehiculoId(clienteId);
                establecerRuta('registrar_vehiculo');
              }}
              alFinalizar={volverDelRegistro}
              alVolver={volverDelRegistro}
            />
          )}
        {!inicializando &&
          ruta === 'registrar_vehiculo' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <RegistrarVehiculo
              sesion={sesion}
              clienteInicialId={clienteInicialVehiculoId}
              etiquetaFinalizar={
                origenRegistro === 'nueva_orden'
                  ? 'Volver a la orden'
                  : 'Finalizar'
              }
              alVehiculoRegistrado={vehiculo => {
                if (origenRegistro !== 'nueva_orden') return;
                actualizarBorrador({
                  clienteId: vehiculo.clienteId,
                  vehiculoId: vehiculo.id,
                });
              }}
              alFinalizar={volverDelRegistro}
              alVolver={volverDelRegistro}
            />
          )}
        {!inicializando &&
          ruta === 'casos_recepcion' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <CasosRecepcion
              alAbrirCaso={caso => {
                abrirCaso(caso);
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
              alAbrirEscaner={() => abrirConexion('detalle_caso_recepcion')}
              alActualizarCaso={establecerCasoRecepcion}
              alAsignarMecanico={() => establecerRuta('asignar_mecanico')}
              alVolver={() => {
                establecerCasoRecepcion(null);
                // regreso a la ficha desde la que abri el caso, sin cerrar su auto
                establecerRuta(
                  origenCaso === 'detalle_cliente' && clienteConsultaId
                    ? 'detalle_cliente'
                    : 'casos_recepcion',
                );
              }}
            />
          )}
        {!inicializando &&
          ruta === 'asignar_mecanico' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword &&
          casoRecepcion && (
            <AsignarMecanico
              key={casoRecepcion.id}
              caso={casoRecepcion}
              sesion={sesion}
              alVolver={() => establecerRuta('detalle_caso_recepcion')}
              alCompletar={caso => {
                establecerCasoRecepcion(caso);
                establecerRuta('detalle_caso_recepcion');
              }}
            />
          )}
        {!inicializando &&
          ruta === 'eliminar_datos_prueba' &&
          sesion?.perfil === 'recepcion' &&
          !sesion.debeCambiarPassword && (
            <EliminarDatosPrueba
              sesion={sesion}
              alVolver={() => establecerRuta('herramientas')}
              alCambiarOperacion={establecerLimpiezaEnCurso}
              alEliminar={() => {
                establecerCasoRecepcion(null);
                establecerClienteInicialVehiculoId(null);
                establecerBorradorOrden(crearBorradorOrdenTrabajo());
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
        {!inicializando &&
          ruta === 'conectar_escaner' &&
          sesion &&
          sesion.perfil !== 'administrador' &&
          !sesion.debeCambiarPassword && (
            <ConectarEscaner
              alVolver={volverDeConexion}
              alPreparado={volverDeConexion}
            />
          )}
        {!inicializando &&
          ruta === 'pruebas_escaner' &&
          PRUEBAS_INTERNAS_HABILITADAS &&
          sesion &&
          !sesion.debeCambiarPassword && (
            <PantallaEscanerObd alVolver={() => establecerRuta('cuenta')} />
          )}
        {!inicializando &&
          ruta === 'cuenta' &&
          sesion &&
          !sesion.debeCambiarPassword && (
            <Cuenta
              sesion={sesion}
              alCerrarSesion={cerrarSesion}
              alAbrirPruebas={
                PRUEBAS_INTERNAS_HABILITADAS
                  ? () => establecerRuta('pruebas_escaner')
                  : undefined
              }
            />
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
