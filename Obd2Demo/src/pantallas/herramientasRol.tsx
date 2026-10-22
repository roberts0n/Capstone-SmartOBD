import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useEstilosTematicos } from '../tema/tokensTema';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alAbrirEscaner: () => void;
  alAbrirNuevaOrden: () => void;
  alAbrirRegistroCliente: () => void;
  alAbrirRegistroVehiculo: () => void;
  alAbrirCasosRecepcion: () => void;
  alAbrirClientesVehiculos: () => void;
  alAbrirLimpieza: () => void;
}

type Destino =
  | 'orden'
  | 'registro_cliente'
  | 'registro_vehiculo'
  | 'casos'
  | 'clientes_vehiculos'
  | 'limpieza'
  | 'escaner';
interface OpcionHerramienta {
  codigo: string;
  titulo: string;
  detalle: string;
  destino: Destino;
}
interface ContenidoRol {
  sobretitulo: string;
  titulo: string;
  descripcion: string;
  opciones: OpcionHerramienta[];
}

const CONTENIDO: Record<'recepcion' | 'mecanico', ContenidoRol> = {
  recepcion: {
    sobretitulo: 'Recepción',
    titulo: '¿Qué necesitas hacer?',
    descripcion:
      'Desde aquí puedes preparar el ingreso de un vehículo y hacer una revisión inicial.',
    opciones: [
      {
        codigo: 'CLI',
        titulo: 'Registrar cliente',
        detalle: 'Agrega una nueva persona al taller',
        destino: 'registro_cliente',
      },
      {
        codigo: 'AUT',
        titulo: 'Registrar vehículo',
        detalle: 'Asigna un vehículo a un cliente registrado',
        destino: 'registro_vehiculo',
      },
      {
        codigo: 'OT',
        titulo: 'Nueva orden de trabajo',
        detalle: 'Selecciona cliente y vehículo, y anota el motivo de ingreso',
        destino: 'orden',
      },
      {
        codigo: 'CAS',
        titulo: 'Casos de recepción',
        detalle: 'Consulta los ingresos registrados en el taller',
        destino: 'casos',
      },
      {
        codigo: 'REG',
        titulo: 'Clientes y vehículos',
        detalle: 'Consulta los registros del taller',
        destino: 'clientes_vehiculos',
      },
      {
        codigo: 'DEL',
        titulo: 'Eliminar datos de prueba',
        detalle: 'Limpia registros seleccionados y sus datos asociados',
        destino: 'limpieza',
      },
    ],
  },
  mecanico: {
    sobretitulo: 'Área de mecánica',
    titulo: 'Herramientas de trabajo',
    descripcion: 'Prepara la conexión con el vehículo.',
    opciones: [
      {
        codigo: 'OBD',
        titulo: 'Conectar escáner',
        detalle: 'Selecciona el adaptador del vehículo',
        destino: 'escaner',
      },
    ],
  },
};

export function HerramientasRol({
  sesion,
  alAbrirEscaner,
  alAbrirNuevaOrden,
  alAbrirRegistroCliente,
  alAbrirRegistroVehiculo,
  alAbrirCasosRecepcion,
  alAbrirClientesVehiculos,
  alAbrirLimpieza,
}: Propiedades) {
  const estilos = useEstilosTematicos(estilosBase);
  const esRecepcion = sesion.perfil !== 'mecanico';
  const contenido = esRecepcion ? CONTENIDO.recepcion : CONTENIDO.mecanico;
  const abrir = (destino: Destino) =>
    resolverDestino(
      destino,
      alAbrirEscaner,
      alAbrirNuevaOrden,
      alAbrirRegistroCliente,
      alAbrirRegistroVehiculo,
      alAbrirCasosRecepcion,
      alAbrirClientesVehiculos,
      alAbrirLimpieza,
    );

  if (esRecepcion) {
    const [cliente, vehiculo, orden, casos, registros, limpieza] =
      CONTENIDO.recepcion.opciones;
    return (
      <ScrollView
        style={estilos.pantalla}
        contentContainerStyle={estilos.contenidoRecepcion}
        showsVerticalScrollIndicator={false}
      >
        <MarcaSmartObd />
        <View style={estilos.introduccion}>
          <Text style={estilos.sobretituloRecepcion}>{'// RECEPCIÓN'}</Text>
          <Text style={estilos.tituloRecepcion}>{contenido.titulo}</Text>
          <Text style={estilos.descripcionRecepcion}>
            {contenido.descripcion}
          </Text>
        </View>

        <View style={estilos.filaTarjetas}>
          <TarjetaHerramienta
            opcion={cliente}
            variante="cuadrada"
            onPress={abrir(cliente.destino)}
          />
          <TarjetaHerramienta
            opcion={vehiculo}
            variante="cuadrada"
            onPress={abrir(vehiculo.destino)}
          />
        </View>
        <TarjetaHerramienta
          opcion={orden}
          variante="destacada"
          onPress={abrir(orden.destino)}
        />
        <View style={estilos.filaTarjetas}>
          <TarjetaHerramienta
            opcion={casos}
            variante="cuadrada"
            onPress={abrir(casos.destino)}
          />
          <TarjetaHerramienta
            opcion={registros}
            variante="cuadrada"
            onPress={abrir(registros.destino)}
          />
        </View>
        <TarjetaHerramienta
          opcion={limpieza}
          variante="peligro"
          onPress={abrir(limpieza.destino)}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenidoGenerico}
    >
      <Text style={estilos.sobretitulo}>{contenido.sobretitulo}</Text>
      <Text style={estilos.titulo}>{contenido.titulo}</Text>
      <Text style={estilos.descripcion}>{contenido.descripcion}</Text>
      <View style={estilos.lista}>
        {contenido.opciones.map(opcion => (
          <Pressable
            accessibilityRole="button"
            key={opcion.codigo}
            onPress={abrir(opcion.destino)}
            style={({ pressed }) => [
              estilos.opcion,
              pressed && estilos.presionada,
            ]}
          >
            <View style={estilos.codigo}>
              <Text style={estilos.textoCodigo}>{opcion.codigo}</Text>
            </View>
            <View style={estilos.textoOpcion}>
              <Text style={estilos.tituloOpcion}>{opcion.titulo}</Text>
              <Text style={estilos.detalle}>{opcion.detalle}</Text>
            </View>
            <Text style={estilos.flecha}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function MarcaSmartObd() {
  const estilos = useEstilosTematicos(estilosBase);
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

type VarianteTarjeta = 'cuadrada' | 'destacada' | 'peligro';
function TarjetaHerramienta({
  opcion,
  variante,
  onPress,
}: {
  opcion: OpcionHerramienta;
  variante: VarianteTarjeta;
  onPress: () => void;
}) {
  const estilos = useEstilosTematicos(estilosBase);
  const destacada = variante === 'destacada';
  const peligro = variante === 'peligro';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={opcion.titulo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.tarjetaBase,
        variante === 'cuadrada' && estilos.tarjetaCuadrada,
        destacada && estilos.tarjetaDestacada,
        peligro && estilos.tarjetaPeligro,
        pressed && estilos.presionada,
      ]}
    >
      <View
        style={[
          estilos.contenedorIcono,
          destacada && estilos.contenedorIconoDestacado,
          peligro && estilos.contenedorIconoPeligro,
        ]}
      >
        <IconoHerramienta
          destino={opcion.destino}
          color={peligro ? '#FF4D55' : destacada ? '#FEFEFE' : '#287FFF'}
        />
      </View>
      <View
        style={[
          estilos.textoTarjeta,
          (destacada || peligro) && estilos.textoTarjetaHorizontal,
        ]}
      >
        <Text
          style={[
            estilos.tituloTarjeta,
            destacada && estilos.tituloTarjetaDestacada,
            peligro && estilos.tituloTarjetaPeligro,
          ]}
        >
          {opcion.titulo}
        </Text>
        <Text
          style={[
            estilos.detalleTarjeta,
            destacada && estilos.detalleTarjetaDestacada,
          ]}
        >
          {opcion.detalle}
        </Text>
      </View>
      {(destacada || peligro) && (
        <Text
          style={[estilos.flechaTarjeta, destacada && estilos.flechaDestacada]}
        >
          →
        </Text>
      )}
    </Pressable>
  );
}

function IconoHerramienta({
  destino,
  color,
}: {
  destino: Destino;
  color: string;
}) {
  const trazo = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };
  if (destino === 'registro_cliente')
    return (
      <Svg width={23} height={23} viewBox="0 0 24 24">
        <Circle cx="8" cy="7" r="3" {...trazo} />
        <Path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2M18 8v6M15 11h6" {...trazo} />
      </Svg>
    );
  if (destino === 'registro_vehiculo')
    return (
      <Svg width={23} height={23} viewBox="0 0 24 24">
        <Path
          d="m5 11 1.5-4h11l1.5 4 2 2v4h-2M5 17H3v-4l2-2M5 11h14M7 17h10"
          {...trazo}
        />
        <Circle cx="7" cy="16" r="1.5" {...trazo} />
        <Circle cx="17" cy="16" r="1.5" {...trazo} />
      </Svg>
    );
  if (destino === 'orden')
    return (
      <Svg width={23} height={23} viewBox="0 0 24 24">
        <Path d="M7 3h7l4 4v14H7ZM14 3v5h4M10 12h5M10 16h5" {...trazo} />
      </Svg>
    );
  if (destino === 'casos')
    return (
      <Svg width={23} height={23} viewBox="0 0 24 24">
        <Path d="M3 7h7l2 2h9v10H3ZM3 7V5h7l2 2" {...trazo} />
      </Svg>
    );
  if (destino === 'clientes_vehiculos')
    return (
      <Svg width={23} height={23} viewBox="0 0 24 24">
        <Path
          d="M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3ZM5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"
          {...trazo}
        />
      </Svg>
    );
  if (destino === 'limpieza')
    return (
      <Svg width={23} height={23} viewBox="0 0 24 24">
        <Path
          d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"
          {...trazo}
        />
      </Svg>
    );
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Rect x="5" y="5" width="14" height="14" rx="3" {...trazo} />
      <Path
        d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M19 9h3M2 15h3M19 15h3"
        {...trazo}
      />
    </Svg>
  );
}

function resolverDestino(
  destino: Destino,
  alAbrirEscaner: () => void,
  alAbrirNuevaOrden: () => void,
  alAbrirRegistroCliente: () => void,
  alAbrirRegistroVehiculo: () => void,
  alAbrirCasosRecepcion: () => void,
  alAbrirClientesVehiculos: () => void,
  alAbrirLimpieza: () => void,
): () => void {
  if (destino === 'orden') return alAbrirNuevaOrden;
  if (destino === 'registro_cliente') return alAbrirRegistroCliente;
  if (destino === 'registro_vehiculo') return alAbrirRegistroVehiculo;
  if (destino === 'casos') return alAbrirCasosRecepcion;
  if (destino === 'clientes_vehiculos') return alAbrirClientesVehiculos;
  if (destino === 'limpieza') return alAbrirLimpieza;
  return alAbrirEscaner;
}

const estilosBase = StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
    contenidoRecepcion: {
      paddingHorizontal: 21,
      paddingTop: 22,
      paddingBottom: 26,
    },
    marca: { flexDirection: 'row', alignItems: 'center' },
    logo: {
      width: 45,
      height: 45,
      borderRadius: 14,
      backgroundColor: '#071329',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    arcoLogo: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.8,
      borderColor: '#287FFF',
      borderBottomColor: 'transparent',
      transform: [{ rotate: '-18deg' }],
    },
    agujaLogo: {
      position: 'absolute',
      width: 9,
      height: 2,
      borderRadius: 2,
      backgroundColor: '#287FFF',
      transform: [{ rotate: '-52deg' }, { translateX: 2 }],
    },
    baseLogo: {
      position: 'absolute',
      bottom: 0,
      width: 25,
      height: 3,
      borderRadius: 3,
      backgroundColor: '#287FFF',
    },
    nombreMarca: {
      color: '#F4F4F5',
      fontSize: 18,
      fontWeight: '800',
      marginLeft: 12,
      letterSpacing: -0.4,
    },
    nombreMarcaAzul: { color: '#287FFF' },
    bajadaMarca: {
      color: '#85858C',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 2.8,
      marginLeft: 13,
      marginTop: 2,
    },
    introduccion: { marginTop: 28, marginBottom: 23 },
    sobretituloRecepcion: {
      color: '#287FFF',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 3.1,
    },
    tituloRecepcion: {
      color: '#F4F4F5',
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.7,
      marginTop: 8,
    },
    descripcionRecepcion: {
      color: '#A1A1AA',
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8,
      maxWidth: 320,
    },
    filaTarjetas: { flexDirection: 'row', gap: 12 },
    tarjetaBase: {
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 21,
      shadowColor: '#101A2E',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    tarjetaCuadrada: {
      flex: 1,
      minWidth: 0,
      minHeight: 169,
      paddingHorizontal: 16,
      paddingVertical: 15,
      marginBottom: 13,
    },
    tarjetaDestacada: {
      minHeight: 88,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#071329',
      borderColor: '#132442',
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 13,
    },
    tarjetaPeligro: {
      minHeight: 75,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#171719',
      borderColor: '#FF4D55',
      borderStyle: 'dashed',
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    contenedorIcono: {
      width: 45,
      height: 45,
      borderRadius: 15,
      backgroundColor: '#153B32',
      alignItems: 'center',
      justifyContent: 'center',
    },
    contenedorIconoDestacado: { backgroundColor: '#287FFF', borderRadius: 14 },
    contenedorIconoPeligro: { backgroundColor: '#351B25' },
    textoTarjeta: { marginTop: 15 },
    textoTarjetaHorizontal: { flex: 1, marginTop: 0, marginHorizontal: 14 },
    tituloTarjeta: {
      color: '#F0F0F2',
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 21,
    },
    tituloTarjetaDestacada: { color: '#FEFEFE' },
    tituloTarjetaPeligro: { color: '#FF4D55' },
    detalleTarjeta: {
      color: '#85858C',
      fontSize: 12,
      lineHeight: 16,
      marginTop: 4,
    },
    detalleTarjetaDestacada: { color: '#C9D8F5' },
    flechaTarjeta: { color: '#85858C', fontSize: 22, fontWeight: '500' },
    flechaDestacada: { color: '#287FFF' },
    presionada: { opacity: 0.7, transform: [{ scale: 0.985 }] },
    contenidoGenerico: {
      paddingHorizontal: 20,
      paddingTop: 28,
      paddingBottom: 30,
    },
    sobretitulo: {
      color: '#10A37F',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    titulo: { color: '#F4F4F5', fontSize: 28, fontWeight: '700', marginTop: 8 },
    descripcion: {
      color: '#A1A1AA',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 10,
    },
    lista: { gap: 11, marginTop: 27 },
    opcion: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 17,
      padding: 14,
    },
    codigo: {
      width: 45,
      height: 45,
      borderRadius: 13,
      backgroundColor: '#153B32',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textoCodigo: { color: '#5BE0BB', fontSize: 11, fontWeight: '800' },
    textoOpcion: { flex: 1, marginHorizontal: 13 },
    tituloOpcion: { color: '#F0F0F2', fontSize: 14, fontWeight: '700' },
    detalle: { color: '#85858C', fontSize: 11, lineHeight: 16, marginTop: 4 },
    flecha: { color: '#71717A', fontSize: 27 },
  });
