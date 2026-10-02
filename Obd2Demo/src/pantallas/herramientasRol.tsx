import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alAbrirEscaner: () => void;
  alAbrirNuevaOrden: () => void;
  alAbrirRegistroCliente: () => void;
  alAbrirRegistroVehiculo: () => void;
  alAbrirCasosRecepcion: () => void;
}

type Destino =
  | 'orden'
  | 'registro_cliente'
  | 'registro_vehiculo'
  | 'casos'
  | 'escaner';

const CONTENIDO = {
  recepcion: {
    sobretitulo: 'Recepción',
    titulo: '¿Qué necesitas registrar?',
    descripcion: 'Desde aquí puedes preparar el ingreso de un vehículo y hacer una revisión inicial.',
    opciones: [
      { codigo: 'CLI', titulo: 'Registrar cliente', detalle: 'Agrega una nueva persona al taller', destino: 'registro_cliente' as Destino },
      { codigo: 'AUT', titulo: 'Registrar vehículo', detalle: 'Asigna un vehículo a un cliente registrado', destino: 'registro_vehiculo' as Destino },
      { codigo: 'OT', titulo: 'Nueva orden de trabajo', detalle: 'Selecciona cliente y vehículo, y anota el motivo de ingreso', destino: 'orden' as Destino },
      { codigo: 'CAS', titulo: 'Casos de recepción', detalle: 'Consulta los ingresos registrados en el taller', destino: 'casos' as Destino },
    ],
  },
  mecanico: {
    sobretitulo: 'Área de mecánica',
    titulo: 'Herramientas de trabajo',
    descripcion: 'Elige la lectura que necesitas para revisar el vehículo.',
    opciones: [
      { codigo: '01', titulo: 'Datos del vehículo', detalle: 'RPM, temperatura y sensores compatibles', destino: 'escaner' as Destino },
      { codigo: 'DTC', titulo: 'Códigos de falla', detalle: 'Consulta códigos confirmados, pendientes y permanentes', destino: 'escaner' as Destino },
      { codigo: 'VIN', titulo: 'Identificar vehículo', detalle: 'Consulta VIN y compatibilidad', destino: 'escaner' as Destino },
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
}: Propiedades) {
  const contenido = sesion.perfil === 'mecanico'
    ? CONTENIDO.mecanico
    : CONTENIDO.recepcion;

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <Text style={estilos.sobretitulo}>{contenido.sobretitulo}</Text>
      <Text style={estilos.titulo}>{contenido.titulo}</Text>
      <Text style={estilos.descripcion}>{contenido.descripcion}</Text>

      <View style={estilos.lista}>
        {contenido.opciones.map(opcion => (
          <Pressable
            accessibilityRole="button"
            key={opcion.codigo}
            onPress={resolverDestino(
              opcion.destino,
              alAbrirEscaner,
              alAbrirNuevaOrden,
              alAbrirRegistroCliente,
              alAbrirRegistroVehiculo,
              alAbrirCasosRecepcion,
            )}
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

function resolverDestino(
  destino: Destino,
  alAbrirEscaner: () => void,
  alAbrirNuevaOrden: () => void,
  alAbrirRegistroCliente: () => void,
  alAbrirRegistroVehiculo: () => void,
  alAbrirCasosRecepcion: () => void,
): () => void {
  if (destino === 'orden') return alAbrirNuevaOrden;
  if (destino === 'registro_cliente') return alAbrirRegistroCliente;
  if (destino === 'registro_vehiculo') return alAbrirRegistroVehiculo;
  if (destino === 'casos') return alAbrirCasosRecepcion;
  return alAbrirEscaner;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 30 },
  sobretitulo: { color: '#10A37F', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  titulo: { color: '#F4F4F5', fontSize: 28, fontWeight: '700', marginTop: 8 },
  descripcion: { color: '#A1A1AA', fontSize: 14, lineHeight: 21, marginTop: 10 },
  lista: { gap: 11, marginTop: 27 },
  opcion: { minHeight: 82, flexDirection: 'row', alignItems: 'center', backgroundColor: '#171719', borderWidth: 1, borderColor: '#303034', borderRadius: 17, padding: 14 },
  presionada: { opacity: 0.72 },
  codigo: { width: 45, height: 45, borderRadius: 13, backgroundColor: '#153B32', alignItems: 'center', justifyContent: 'center' },
  textoCodigo: { color: '#5BE0BB', fontSize: 11, fontWeight: '800' },
  textoOpcion: { flex: 1, marginHorizontal: 13 },
  tituloOpcion: { color: '#F0F0F2', fontSize: 14, fontWeight: '700' },
  detalle: { color: '#85858C', fontSize: 11, lineHeight: 16, marginTop: 4 },
  flecha: { color: '#71717A', fontSize: 27 },
});

