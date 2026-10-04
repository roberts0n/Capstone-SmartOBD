import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { State } from 'react-native-ble-plx';
import { useSesionEscanerObd } from '../escaner/ContextoEscanerObd';
import {
  clasificarDispositivo,
  nombreDispositivo,
  ordenarCandidatos,
} from '../escaneres/PerfilesEscaner';
import type { InformacionDispositivoBle } from '../tipos/ble';

interface Propiedades {
  alVolver: () => void;
  alPreparado: () => void;
}

export function ConectarEscaner({ alVolver, alPreparado }: Propiedades) {
  const sesion = useSesionEscanerObd();
  const [ocupado, establecerOcupado] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const [mostrarTodos, establecerMostrarTodos] = useState(false);
  const [busqueda, establecerBusqueda] = useState('');
  const [limite, establecerLimite] = useState(15);
  const [busquedaRealizada, establecerBusquedaRealizada] = useState(false);
  const [cambiar, establecerCambiar] = useState(false);
  const actual = useRef(sesion);
  const acciones = useRef({ alVolver, alPreparado });
  actual.current = sesion;
  acciones.current = { alVolver, alPreparado };
  const montado = useRef(false);
  const bloqueo = useRef(false);
  const intentoConexion = useRef(false);
  const busquedaPendiente = useRef(false);
  const preparada = sesion.estaPreparado();
  const buscando = sesion.estadoConexion === 'buscando';
  const disponible =
    sesion.estadoPermisos === 'concedidos' &&
    sesion.estadoBluetooth === State.PoweredOn;

  async function buscar() {
    if (bloqueo.current || intentoConexion.current) return;
    bloqueo.current = true;
    busquedaPendiente.current = true;
    establecerOcupado(true);
    establecerError(null);
    try {
      const lista = await actual.current.prepararBluetooth();
      if (!montado.current) return;
      if (!lista) {
        return;
      }
      busquedaPendiente.current = false;
      await actual.current.iniciarEscaneo();
      if (montado.current) establecerBusquedaRealizada(true);
    } catch (capturado) {
      busquedaPendiente.current = false;
      if (montado.current) establecerError(mensajeError(capturado));
    } finally {
      bloqueo.current = false;
      if (montado.current) establecerOcupado(false);
    }
  }

  function volver() {
    busquedaPendiente.current = false;
    actual.current.detenerEscaneo();
    if (intentoConexion.current)
      actual.current.cancelarPreparacion().catch(() => undefined);
    acciones.current.alVolver();
  }

  useEffect(() => {
    montado.current = true;
    const refrescar = async () => {
      const lista = await actual.current.actualizarBluetooth();
      if (montado.current && lista && busquedaPendiente.current) await buscar();
    };
    refrescar().catch(() => undefined);
    const estado = AppState.addEventListener('change', siguiente => {
      if (siguiente === 'active') refrescar().catch(() => undefined);
    });
    const atras = BackHandler.addEventListener('hardwareBackPress', () => {
      volver();
      return true;
    });
    return () => {
      montado.current = false;
      busquedaPendiente.current = false;
      actual.current.detenerEscaneo();
      if (intentoConexion.current)
        actual.current.cancelarPreparacion().catch(() => undefined);
      estado.remove();
      atras.remove();
    };
  }, []);

  useEffect(() => {
    // retomo solo la busqueda que el trabajador ya habia pedido
    if (
      sesion.estadoPermisos === 'denegados' ||
      sesion.estadoPermisos === 'bloqueados'
    )
      busquedaPendiente.current = false;
    if (disponible && busquedaPendiente.current)
      buscar().catch(() => undefined);
  }, [disponible, sesion.estadoPermisos]);

  async function abrirAjustes(bluetooth: boolean) {
    try {
      if (bluetooth) busquedaPendiente.current = true;
      if (bluetooth && Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
      } else {
        await Linking.openSettings();
      }
    } catch {
      establecerError(
        'No se pudieron abrir los ajustes. Activa Bluetooth y los permisos desde Ajustes del teléfono.',
      );
    }
  }

  function continuar() {
    if (montado.current && actual.current.estaPreparado())
      acciones.current.alPreparado();
  }

  async function conectar(dispositivo: InformacionDispositivoBle) {
    if (bloqueo.current || intentoConexion.current) return;
    bloqueo.current = true;
    intentoConexion.current = true;
    busquedaPendiente.current = false;
    establecerOcupado(true);
    establecerError(null);
    try {
      const advertencia = await actual.current.conectarYVerificar(dispositivo);
      if (!montado.current || !actual.current.estaPreparado()) return;
      intentoConexion.current = false;
      establecerCambiar(false);
      if (advertencia) {
        Alert.alert('Escáner conectado', advertencia, [
          { text: 'Continuar', onPress: continuar },
        ]);
      } else {
        continuar();
      }
    } catch (capturado) {
      if (montado.current) establecerError(mensajeError(capturado));
    } finally {
      intentoConexion.current = false;
      bloqueo.current = false;
      if (montado.current) establecerOcupado(false);
    }
  }

  const prioridad = ordenarCandidatos(
    sesion.dispositivos.map(dispositivo =>
      clasificarDispositivo(dispositivo, sesion.escaneresGuardados),
    ),
  );
  const filtro = busqueda.trim().toLowerCase();
  const guardados = sesion.escaneresGuardados
    .map(
      guardado =>
        sesion.dispositivos.find(
          dispositivo => dispositivo.id === guardado.id,
        ) ?? {
          id: guardado.id,
          nombre: guardado.nombre,
          nombreLocal: guardado.nombreLocal,
          rssi: null,
        },
    )
    .filter(dispositivo =>
      `${nombreDispositivo(dispositivo)} ${dispositivo.id}`
        .toLowerCase()
        .includes(filtro),
    );
  const cercanos = prioridad.filter(
    candidato =>
      candidato.nivel !== 'guardado' &&
      (mostrarTodos || candidato.nivel !== 'desconocido') &&
      `${nombreDispositivo(candidato.dispositivo)} ${candidato.dispositivo.id}`
        .toLowerCase()
        .includes(filtro),
  );
  const sinPermisos = sesion.estadoPermisos !== 'concedidos';
  const errorVisible =
    error ??
    (sesion.estadoConexion === 'error'
      ? 'No se pudo completar la conexión o la búsqueda. Intenta nuevamente.'
      : null);
  const apagado = sesion.estadoBluetooth === State.PoweredOff;
  const tituloBluetooth = sinPermisos
    ? 'Permisos Bluetooth'
    : apagado
    ? 'Bluetooth apagado'
    : sesion.estadoBluetooth === State.Unsupported
    ? 'Bluetooth no compatible'
    : sesion.estadoBluetooth === State.Unauthorized
    ? 'Bluetooth no autorizado'
    : 'Comprobando Bluetooth…';

  function dispositivoEnLista(
    dispositivo: InformacionDispositivoBle,
    guardado = false,
  ) {
    return (
      <Pressable
        key={dispositivo.id}
        accessibilityRole="button"
        accessibilityLabel={`Conectar ${nombreDispositivo(dispositivo)} ${
          dispositivo.id
        }`}
        disabled={
          ocupado ||
          !disponible ||
          sesion.conexionEnCurso ||
          sesion.cargandoGuardados
        }
        onPress={() => conectar(dispositivo)}
        style={({ pressed }) => [
          estilos.tarjeta,
          pressed && estilos.presionado,
        ]}
      >
        <View style={estilos.identidad}>
          <Text style={estilos.nombre}>{nombreDispositivo(dispositivo)}</Text>
          <Text style={estilos.secundario}>{dispositivo.id}</Text>
          {guardado &&
          !sesion.dispositivos.some(
            elemento => elemento.id === dispositivo.id,
          ) ? (
            <Text style={estilos.secundario}>
              Guardado · no detectado en esta búsqueda
            </Text>
          ) : null}
        </View>
        <Text style={estilos.flecha}>›</Text>
      </Pressable>
    );
  }

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable accessibilityRole="button" onPress={volver}>
        <Text style={estilos.enlace}>‹ Volver</Text>
      </Pressable>
      <Text style={estilos.titulo}>Conectar escáner</Text>
      {!disponible ? (
        <View style={estilos.bloque}>
          <Text style={estilos.nombre}>{tituloBluetooth}</Text>
          {sinPermisos ? (
            <>
              <Text style={estilos.secundario}>
                Permite buscar dispositivos cercanos para conectar el escáner.
              </Text>
              <Boton
                etiqueta={
                  sesion.estadoPermisos === 'bloqueados'
                    ? 'Abrir ajustes de la app'
                    : 'Permitir Bluetooth'
                }
                deshabilitado={ocupado}
                alPulsar={() =>
                  sesion.estadoPermisos === 'bloqueados'
                    ? abrirAjustes(false)
                    : buscar()
                }
              />
              {sesion.estadoPermisos === 'denegados' ? (
                <Boton
                  etiqueta="Abrir ajustes de la app"
                  alPulsar={() => abrirAjustes(false)}
                  secundario
                />
              ) : null}
            </>
          ) : apagado ? (
            <Boton
              etiqueta="Activar Bluetooth en ajustes"
              alPulsar={() => abrirAjustes(true)}
            />
          ) : sesion.estadoBluetooth !== State.Unsupported ? (
            <Boton
              etiqueta="Comprobar de nuevo"
              alPulsar={() => buscar()}
              deshabilitado={ocupado}
            />
          ) : null}
        </View>
      ) : null}
      {errorVisible ? (
        <Text accessibilityRole="alert" style={estilos.error}>
          {errorVisible}
        </Text>
      ) : null}
      {ocupado ? (
        <View style={estilos.progreso}>
          <ActivityIndicator color="#10A37F" />
          <Text style={estilos.secundario}>
            {sesion.estadoPreparacion === 'verificando'
              ? 'Verificando escáner…'
              : intentoConexion.current
              ? 'Conectando…'
              : 'Comprobando Bluetooth…'}
          </Text>
        </View>
      ) : null}
      {preparada && !cambiar ? (
        <View style={estilos.bloque}>
          <Text style={estilos.nombre}>
            {sesion.dispositivoConectado
              ? nombreDispositivo(sesion.dispositivoConectado)
              : 'Escáner'}
          </Text>
          <Text style={estilos.verde}>Escáner preparado</Text>
          <Boton etiqueta="Continuar" alPulsar={continuar} />
          <Boton
            etiqueta="Cambiar escáner"
            secundario
            alPulsar={() => {
              establecerCambiar(true);
              buscar().catch(() => undefined);
            }}
          />
        </View>
      ) : (
        <>
          <Boton
            etiqueta={
              buscando
                ? 'Detener búsqueda'
                : busquedaRealizada
                ? 'Buscar de nuevo'
                : 'Buscar escáner'
            }
            deshabilitado={ocupado || !disponible || sesion.conexionEnCurso}
            alPulsar={() => (buscando ? sesion.detenerEscaneo() : buscar())}
          />
          {buscando ? (
            <Text style={estilos.secundario}>
              Buscando dispositivos cercanos…
            </Text>
          ) : null}
          {sesion.errorGuardados ? (
            <Text style={estilos.error}>
              No se pudo leer la lista de escáneres guardados. Puedes conectar
              uno cercano.
            </Text>
          ) : null}
          {sesion.cargandoGuardados ? (
            <Text style={estilos.secundario}>
              Cargando escáneres guardados…
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel="Filtrar escáneres"
            placeholder="Buscar por nombre o identificador"
            placeholderTextColor="#71717A"
            value={busqueda}
            onChangeText={texto => {
              establecerBusqueda(texto);
              establecerLimite(15);
            }}
            style={estilos.campo}
          />
          {guardados.length ? (
            <>
              <Text style={estilos.seccion}>Guardados</Text>
              {guardados.map(dispositivo =>
                dispositivoEnLista(dispositivo, true),
              )}
            </>
          ) : null}
          <Text style={estilos.seccion}>Cercanos</Text>
          {cercanos
            .slice(0, limite)
            .map(candidato => dispositivoEnLista(candidato.dispositivo))}
          {disponible &&
          busquedaRealizada &&
          !buscando &&
          sesion.estadoConexion !== 'error' &&
          !ocupado &&
          !cercanos.length ? (
            <Text style={estilos.secundario}>
              No hay dispositivos que coincidan. Prueba otra búsqueda o muestra
              todos.
            </Text>
          ) : null}
          {cercanos.length > limite ? (
            <Boton
              etiqueta="Mostrar más"
              secundario
              alPulsar={() => establecerLimite(limite + 15)}
            />
          ) : null}
          <Boton
            etiqueta={
              mostrarTodos
                ? 'Mostrar solo candidatos'
                : 'Mostrar todos los dispositivos'
            }
            secundario
            alPulsar={() => {
              establecerMostrarTodos(!mostrarTodos);
              establecerLimite(15);
            }}
          />
        </>
      )}
    </ScrollView>
  );
}

function Boton({
  etiqueta,
  alPulsar,
  deshabilitado = false,
  secundario = false,
}: {
  etiqueta: string;
  alPulsar: () => void;
  deshabilitado?: boolean;
  secundario?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={deshabilitado}
      onPress={alPulsar}
      style={({ pressed }) => [
        estilos.boton,
        secundario && estilos.botonSecundario,
        (pressed || deshabilitado) && estilos.presionado,
      ]}
    >
      <Text style={estilos.textoBoton}>{etiqueta}</Text>
    </Pressable>
  );
}

function mensajeError(capturado: unknown) {
  return capturado instanceof Error ? capturado.message : String(capturado);
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { padding: 20, paddingBottom: 32, gap: 12 },
  enlace: { color: '#5BE0BB', fontSize: 14, paddingVertical: 8 },
  titulo: {
    color: '#F4F4F5',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  bloque: {
    padding: 16,
    gap: 12,
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 16,
  },
  tarjeta: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 13,
  },
  identidad: { flex: 1, gap: 5 },
  nombre: { color: '#F0F0F2', fontSize: 15, fontWeight: '600' },
  secundario: { color: '#A1A1AA', fontSize: 12, lineHeight: 18 },
  seccion: { color: '#E7E7EA', fontSize: 16, fontWeight: '600', marginTop: 10 },
  flecha: { color: '#5BE0BB', fontSize: 25 },
  verde: { color: '#5BE0BB', fontSize: 13 },
  error: { color: '#FF9C94', fontSize: 13, lineHeight: 20 },
  campo: {
    color: '#F4F4F5',
    backgroundColor: '#171719',
    borderColor: '#303034',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    minHeight: 48,
  },
  boton: {
    backgroundColor: '#10A37F',
    borderRadius: 12,
    minHeight: 48,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botonSecundario: { backgroundColor: '#242427' },
  textoBoton: { color: '#F4F4F5', fontSize: 14, fontWeight: '600' },
  presionado: { opacity: 0.5 },
  progreso: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
});
