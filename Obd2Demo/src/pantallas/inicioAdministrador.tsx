import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  obtenerResumenAdministrador,
  type IntegranteTaller,
  type ResumenAdministrador,
} from '../servicios/personalTaller';
import { crearEstilosTematicos } from '../tema/tokensTema';
import type { PerfilTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  alAbrirRegistro: () => void;
}

export function InicioAdministrador({ alAbrirRegistro }: Propiedades) {
  const [resumen, establecerResumen] = useState<ResumenAdministrador | null>(
    null,
  );
  const [cargando, establecerCargando] = useState(true);
  const [actualizando, establecerActualizando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);

  const cargarResumen = useCallback(async (esActualizacion = false) => {
    if (esActualizacion) establecerActualizando(true);
    else establecerCargando(true);
    establecerError(null);

    try {
      establecerResumen(await obtenerResumenAdministrador());
    } catch (capturado) {
      establecerError(
        capturado instanceof Error
          ? capturado.message
          : 'No fue posible cargar el resumen del taller.',
      );
    } finally {
      establecerCargando(false);
      establecerActualizando(false);
    }
  }, []);

  useEffect(() => {
    cargarResumen().catch(() => undefined);
  }, [cargarResumen]);

  const equipo = resumen?.equipo ?? [];

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={() => cargarResumen(true)}
          tintColor="#287FFF"
        />
      }
    >
      <MarcaSmartObd />

      <PanelEquipo equipo={equipo} cargando={cargando && !resumen} />

      {!cargando && equipo.length > 0 && (
        <View style={estilos.listaEquipo}>
          {equipo.map(integrante => (
            <TarjetaIntegrante key={integrante.id} integrante={integrante} />
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={alAbrirRegistro}
        style={({ pressed }) => [
          estilos.botonAgregar,
          pressed && estilos.presionado,
        ]}
      >
        <Text style={estilos.simboloAgregar}>♙＋</Text>
        <Text style={estilos.textoBoton}>Agregar integrante</Text>
      </Pressable>

      {error && (
        <View style={estilos.avisoError}>
          <Text accessibilityRole="alert" style={estilos.textoError}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => cargarResumen()}
            hitSlop={8}
          >
            <Text style={estilos.reintentar}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      <View style={estilos.cabeceraSeccion}>
        <Text style={estilos.tituloSeccion}>Estado del trabajo</Text>
        <Text style={estilos.auxiliarSeccion}>CASOS DEL TALLER</Text>
      </View>
      <View style={estilos.panelEstados}>
        <EstadoTrabajo
          color="#58A6FF"
          titulo="Por revisar"
          descripcion="Ingresados o con diagnóstico inicial"
          valor={resumen?.porRevisar}
          cargando={cargando && !resumen}
        />
        <View style={estilos.separadorEstado} />
        <EstadoTrabajo
          color="#F4B860"
          titulo="En trabajo"
          descripcion="Asignados o actualmente en revisión"
          valor={resumen?.enTrabajo}
          cargando={cargando && !resumen}
        />
        <View style={estilos.separadorEstado} />
        <EstadoTrabajo
          color="#43D6AE"
          titulo="Diagnosticados"
          descripcion="Con diagnóstico registrado o caso cerrado"
          valor={resumen?.diagnosticos}
          cargando={cargando && !resumen}
        />
      </View>
    </ScrollView>
  );
}

function MarcaSmartObd() {
  return (
    <View style={estilos.marca}>
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

function PanelEquipo({
  equipo,
  cargando,
}: {
  equipo: IntegranteTaller[];
  cargando: boolean;
}) {
  const mecanicos = equipo.filter(item => item.rol === 'mecanico').length;
  const recepcionistas = equipo.filter(item => item.rol === 'recepcion').length;

  return (
    <View style={estilos.panelEquipo}>
      <View style={estilos.lineasDecorativas}>
        <View style={estilos.lineaDecorativaClara} />
        <View style={estilos.lineaDecorativaOscura} />
        <View style={estilos.lineaDecorativaClara} />
      </View>
      <Text style={estilos.sobretituloEquipo}>EQUIPO</Text>
      <Text style={estilos.tituloEquipo}>Equipo del taller</Text>
      {cargando ? (
        <View style={estilos.cargandoEquipo}>
          <ActivityIndicator color="#287FFF" size="small" />
          <Text style={estilos.textoCargando}>Cargando integrantes...</Text>
        </View>
      ) : (
        <>
          <Text style={estilos.resumenEquipo}>
            {equipo.length}{' '}
            {equipo.length === 1 ? 'persona con acceso' : 'personas con acceso'}
            {' a este taller.'}
          </Text>
          <View style={estilos.detalleEquipo}>
            <View style={estilos.avataresEquipo}>
              {equipo.slice(0, 4).map((integrante, indice) => (
                <View
                  key={integrante.id}
                  style={[
                    estilos.avatarSuperpuesto,
                    indice > 0 && estilos.avatarSuperpuestoSeparado,
                  ]}
                >
                  <Text style={estilos.textoAvatarSuperpuesto}>
                    {obtenerIniciales(integrante.nombre)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={estilos.totalesRoles}>
              <Text style={estilos.totalRol}>♧ {mecanicos} mecánica</Text>
              <Text style={estilos.totalRol}>▤ {recepcionistas} recepción</Text>
            </View>
          </View>
        </>
      )}
      <View style={estilos.escudoDecorativo}>
        <Svg width={78} height={84} viewBox="0 0 78 84">
          <Path
            d="M39 4C28 12 17 15 7 17v23c0 20 11 32 32 40 21-8 32-20 32-40V17C61 15 50 12 39 4Z"
            fill="none"
            stroke="#344158"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <Path
            d="m25 42 9 9 19-21"
            fill="none"
            stroke="#344158"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
}

function TarjetaIntegrante({ integrante }: { integrante: IntegranteTaller }) {
  return (
    <View style={estilos.tarjetaIntegrante}>
      <View style={estilos.avatarIntegrante}>
        <Text style={estilos.textoAvatarIntegrante}>
          {obtenerIniciales(integrante.nombre)}
        </Text>
      </View>
      <View style={estilos.datosIntegrante}>
        <Text style={estilos.nombreIntegrante} numberOfLines={1}>
          {integrante.nombre}
        </Text>
        <Text style={estilos.detalleIntegrante} numberOfLines={1}>
          {detalleIntegrante(integrante)}
        </Text>
      </View>
      <View style={estilos.etiquetaRol}>
        <Text style={estilos.textoRol}>{nombreRol(integrante.rol)}</Text>
      </View>
    </View>
  );
}

function EstadoTrabajo({
  color,
  titulo,
  descripcion,
  valor,
  cargando,
}: {
  color: string;
  titulo: string;
  descripcion: string;
  valor: number | undefined;
  cargando: boolean;
}) {
  return (
    <View style={estilos.filaEstadoTrabajo}>
      <View style={[estilos.puntoEstadoTrabajo, { backgroundColor: color }]} />
      <View style={estilos.textoEstadoTrabajo}>
        <Text style={estilos.tituloEstadoTrabajo}>{titulo}</Text>
        <Text style={estilos.descripcionEstadoTrabajo}>{descripcion}</Text>
      </View>
      <View style={estilos.contadorEstado}>
        <Text style={estilos.valorEstado}>{cargando ? '…' : valor ?? '—'}</Text>
      </View>
    </View>
  );
}

function obtenerIniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  return `${partes[0][0]}${
    partes.length > 1 ? partes[1][0] : ''
  }`.toUpperCase();
}

function detalleIntegrante(integrante: IntegranteTaller): string {
  if (integrante.rol === 'mecanico') {
    return integrante.especialidad
      ? `Especialidad: ${integrante.especialidad}`
      : 'Área de mecánica';
  }
  if (integrante.rol === 'recepcion') return 'Atención y recepción del taller';
  return 'Administración del taller';
}

function nombreRol(rol: PerfilTaller): string {
  if (rol === 'mecanico') return 'MECÁNICO';
  if (rol === 'recepcion') return 'RECEPCIÓN';
  return 'ADMINISTRADOR';
}

const estilos = StyleSheet.create(
  crearEstilosTematicos({
    pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
    contenido: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 34 },
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
    panelEquipo: {
      minHeight: 151,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#2A2A2E',
      borderRadius: 20,
      padding: 16,
      overflow: 'hidden',
    },
    lineasDecorativas: {
      position: 'absolute',
      top: 0,
      right: 15,
      height: 6,
      flexDirection: 'row',
      transform: [{ skewX: '-35deg' }],
    },
    lineaDecorativaClara: { width: 21, backgroundColor: '#55C7FF' },
    lineaDecorativaOscura: { width: 21, backgroundColor: '#287FFF' },
    sobretituloEquipo: {
      color: '#287FFF',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1.7,
    },
    tituloEquipo: {
      color: '#F4F4F5',
      fontSize: 21,
      fontWeight: '800',
      marginTop: 6,
    },
    resumenEquipo: { color: '#A1A1AA', fontSize: 11, marginTop: 4 },
    cargandoEquipo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginTop: 20,
    },
    textoCargando: { color: '#85858C', fontSize: 10 },
    detalleEquipo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
    },
    avataresEquipo: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 106,
    },
    avatarSuperpuesto: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#287FFF',
      borderWidth: 2,
      borderColor: '#121214',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarSuperpuestoSeparado: { marginLeft: -8 },
    textoAvatarSuperpuesto: {
      color: '#FEFEFE',
      fontSize: 9,
      fontWeight: '800',
    },
    totalesRoles: { gap: 7, marginLeft: 8 },
    totalRol: { color: '#EDEDEF', fontSize: 9, fontWeight: '700' },
    escudoDecorativo: {
      position: 'absolute',
      right: -7,
      bottom: -8,
      opacity: 0.55,
    },
    listaEquipo: { gap: 9, marginTop: 15 },
    tarjetaIntegrante: {
      minHeight: 61,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 16,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    avatarIntegrante: {
      width: 37,
      height: 37,
      borderRadius: 19,
      backgroundColor: '#153B32',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textoAvatarIntegrante: {
      color: '#5BE0BB',
      fontSize: 10,
      fontWeight: '800',
    },
    datosIntegrante: { flex: 1, marginHorizontal: 11, minWidth: 0 },
    nombreIntegrante: { color: '#F0F0F2', fontSize: 12, fontWeight: '800' },
    detalleIntegrante: { color: '#85858C', fontSize: 9, marginTop: 3 },
    etiquetaRol: {
      backgroundColor: '#153B32',
      borderWidth: 1,
      borderColor: '#2D6B5B',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    textoRol: {
      color: '#5BE0BB',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 0.7,
    },
    botonAgregar: {
      minHeight: 49,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#10A37F',
      borderRadius: 15,
      marginTop: 15,
      paddingHorizontal: 16,
    },
    simboloAgregar: {
      color: '#FEFEFE',
      fontSize: 14,
      fontWeight: '800',
      marginRight: 7,
    },
    textoBoton: { color: '#FEFEFE', fontSize: 13, fontWeight: '800' },
    presionado: { opacity: 0.72, transform: [{ scale: 0.99 }] },
    avisoError: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 10,
    },
    textoError: { flex: 1, color: '#FF9C94', fontSize: 10, lineHeight: 15 },
    reintentar: { color: '#53D9B4', fontSize: 10, fontWeight: '700' },
    cabeceraSeccion: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 25,
      marginBottom: 11,
    },
    tituloSeccion: { color: '#F4F4F5', fontSize: 16, fontWeight: '800' },
    auxiliarSeccion: { color: '#85858C', fontSize: 8, letterSpacing: 1.5 },
    panelEstados: {
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#2A2A2E',
      borderRadius: 17,
      paddingHorizontal: 15,
    },
    filaEstadoTrabajo: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
    },
    puntoEstadoTrabajo: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 12,
    },
    textoEstadoTrabajo: { flex: 1, paddingRight: 12 },
    tituloEstadoTrabajo: { color: '#F0F0F2', fontSize: 12, fontWeight: '800' },
    descripcionEstadoTrabajo: {
      color: '#85858C',
      fontSize: 9,
      lineHeight: 14,
      marginTop: 3,
    },
    contadorEstado: {
      minWidth: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: '#153B32',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    valorEstado: { color: '#5BE0BB', fontSize: 13, fontWeight: '800' },
    separadorEstado: { height: 1, backgroundColor: '#2A2A2E' },
  }),
);

export default InicioAdministrador;
