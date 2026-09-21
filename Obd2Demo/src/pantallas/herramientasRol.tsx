import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alAbrirEscaner: () => void;
}

const CONTENIDO = {
  recepcion: {
    sobretitulo: 'RECEPCION DEL TALLER',
    titulo: 'Organiza cada ingreso',
    descripcion: 'Herramientas para recibir vehículos y preparar el trabajo técnico.',
    opciones: [
      { codigo: 'OT', titulo: 'Nueva orden de trabajo', detalle: 'Cliente, vehículo y motivo de ingreso', disponible: false },
      { codigo: 'DIA', titulo: 'Vehículos del día', detalle: 'Revisa la carga actual del taller', disponible: false },
      { codigo: 'OBD', titulo: 'Diagnóstico de ingreso', detalle: 'Obtén el estado inicial con el escáner', disponible: true },
    ],
  },
  mecanico: {
    sobretitulo: 'TRABAJO TECNICO',
    titulo: 'Herramientas de diagnóstico',
    descripcion: 'Acceso rápido a las funciones disponibles del escáner SmartOBD.',
    opciones: [
      { codigo: '01', titulo: 'Datos en tiempo real', detalle: 'RPM, temperatura y sensores compatibles', disponible: true },
      { codigo: 'DTC', titulo: 'Códigos de falla', detalle: 'Lee e interpreta alertas almacenadas', disponible: true },
      { codigo: 'VIN', titulo: 'Identificar vehículo', detalle: 'Consulta VIN y compatibilidad', disponible: true },
    ],
  },
};

export function HerramientasRol({ sesion, alAbrirEscaner }: Propiedades) {
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
            accessibilityState={{ disabled: !opcion.disponible }}
            disabled={!opcion.disponible}
            key={opcion.codigo}
            onPress={opcion.disponible ? alAbrirEscaner : undefined}
            style={({ pressed }) => [
              estilos.opcion,
              !opcion.disponible && estilos.noDisponible,
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
            <Text style={opcion.disponible ? estilos.flecha : estilos.proximo}>
              {opcion.disponible ? '›' : 'PROX.'}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 30 },
  sobretitulo: { color: '#10A37F', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  titulo: { color: '#F4F4F5', fontSize: 28, fontWeight: '700', marginTop: 8 },
  descripcion: { color: '#A1A1AA', fontSize: 14, lineHeight: 21, marginTop: 10 },
  lista: { gap: 11, marginTop: 27 },
  opcion: { minHeight: 82, flexDirection: 'row', alignItems: 'center', backgroundColor: '#171719', borderWidth: 1, borderColor: '#303034', borderRadius: 17, padding: 14 },
  noDisponible: { opacity: 0.55 },
  presionada: { opacity: 0.72 },
  codigo: { width: 45, height: 45, borderRadius: 13, backgroundColor: '#153B32', alignItems: 'center', justifyContent: 'center' },
  textoCodigo: { color: '#5BE0BB', fontSize: 11, fontWeight: '800' },
  textoOpcion: { flex: 1, marginHorizontal: 13 },
  tituloOpcion: { color: '#F0F0F2', fontSize: 14, fontWeight: '700' },
  detalle: { color: '#85858C', fontSize: 11, lineHeight: 16, marginTop: 4 },
  flecha: { color: '#71717A', fontSize: 27 },
  proximo: { color: '#71717A', fontSize: 9, fontWeight: '800' },
});

