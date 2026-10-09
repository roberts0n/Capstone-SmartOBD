import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alAbrirCuenta: () => void;
  alAbrirRegistro: () => void;
  alAbrirEscaner: () => void;
}

const INDICADORES = [
  { etiqueta: 'Personal activo', color: '#58A6FF' },
  { etiqueta: 'Casos abiertos', color: '#10A37F' },
  { etiqueta: 'Vehículos registrados', color: '#F4B860' },
  { etiqueta: 'Diagnósticos', color: '#C7A6FF' },
];

export function InicioAdministrador({
  sesion,
  alAbrirCuenta,
  alAbrirRegistro,
  alAbrirEscaner,
}: Propiedades) {
  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
    >
      <View style={estilos.cabecera}>
        <View style={estilos.identidad}>
          <Text style={estilos.taller}>{sesion.taller}</Text>
          <Text style={estilos.saludo}>Hola, {primerNombre(sesion.nombre)}</Text>
          <Text style={estilos.perfil}>Administrador</Text>
        </View>
        <Pressable
          accessibilityLabel="Abrir cuenta"
          accessibilityRole="button"
          onPress={alAbrirCuenta}
          style={estilos.avatar}
        >
          <Text style={estilos.inicial}>
            {sesion.nombre.charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <View style={estilos.tarjetaPrincipal}>
        <View style={estilos.filaEtiqueta}>
          <View style={estilos.puntoActivo} />
          <Text style={estilos.etiquetaPrincipal}>Panel del taller</Text>
        </View>
        <Text style={estilos.tituloPrincipal}>Organiza el trabajo del equipo</Text>
        <Text style={estilos.descripcionPrincipal}>
          Agrega personal y mantén a mano los accesos principales del taller.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={alAbrirRegistro}
          style={({ pressed }) => [
            estilos.botonPrincipal,
            pressed && estilos.presionado,
          ]}
        >
          <Text style={estilos.simboloAgregar}>＋</Text>
          <Text style={estilos.textoBoton}>Agregar integrante</Text>
        </Pressable>
      </View>

      <View style={estilos.cabeceraSeccion}>
        <Text style={estilos.tituloSeccion}>Vista general</Text>
        <View style={estilos.etiquetaVisual}>
          <Text style={estilos.textoEtiquetaVisual}>Vista previa</Text>
        </View>
      </View>
      <View style={estilos.cuadricula}>
        {INDICADORES.map(indicador => (
          <View key={indicador.etiqueta} style={estilos.indicador}>
            <View
              style={[estilos.lineaIndicador, { backgroundColor: indicador.color }]}
            />
            <Text style={estilos.valorIndicador}>—</Text>
            <Text style={estilos.nombreIndicador}>{indicador.etiqueta}</Text>
          </View>
        ))}
      </View>

      <Text style={estilos.aclaracion}>
        Los totales aparecerán cuando el proyecto tenga una consulta consolidada para administración.
      </Text>

      <View style={estilos.cabeceraSeccion}>
        <Text style={estilos.tituloSeccion}>Accesos rápidos</Text>
      </View>
      <View style={estilos.listaAcciones}>
        <Accion
          codigo="USR"
          titulo="Personal del taller"
          descripcion="Crea cuentas para recepción y mecánica"
          alPresionar={alAbrirRegistro}
        />
        <Accion
          codigo="OBD"
          titulo="Escáner OBD-II"
          descripcion="Abre las herramientas de conexión y lectura"
          alPresionar={alAbrirEscaner}
        />
      </View>
    </ScrollView>
  );
}

function Accion({
  codigo,
  titulo,
  descripcion,
  alPresionar,
}: {
  codigo: string;
  titulo: string;
  descripcion: string;
  alPresionar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={alPresionar}
      style={({ pressed }) => [estilos.accion, pressed && estilos.presionado]}
    >
      <View style={estilos.codigoAccion}>
        <Text style={estilos.textoCodigo}>{codigo}</Text>
      </View>
      <View style={estilos.textoAccion}>
        <Text style={estilos.tituloAccion}>{titulo}</Text>
        <Text style={estilos.descripcionAccion}>{descripcion}</Text>
      </View>
      <Text style={estilos.flecha}>›</Text>
    </Pressable>
  );
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 42 },
  cabecera: { flexDirection: 'row', alignItems: 'center' },
  identidad: { flex: 1, paddingRight: 12 },
  taller: {
    color: '#10A37F',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  saludo: { color: '#F4F4F5', fontSize: 25, fontWeight: '700', marginTop: 5 },
  perfil: { color: '#8B8B93', fontSize: 11, marginTop: 6 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#153B32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { color: '#5BE0BB', fontSize: 15, fontWeight: '700' },
  tarjetaPrincipal: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 20,
    padding: 18,
    marginTop: 22,
  },
  filaEtiqueta: { flexDirection: 'row', alignItems: 'center' },
  puntoActivo: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10A37F', marginRight: 7 },
  etiquetaPrincipal: { color: '#53D9B4', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  tituloPrincipal: { color: '#F4F4F5', fontSize: 23, lineHeight: 29, fontWeight: '700', marginTop: 14 },
  descripcionPrincipal: { color: '#96969D', fontSize: 12, lineHeight: 19, marginTop: 8 },
  botonPrincipal: {
    minHeight: 47,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10A37F',
    borderRadius: 12,
    paddingHorizontal: 17,
    marginTop: 18,
  },
  simboloAgregar: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginRight: 7 },
  textoBoton: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  presionado: { opacity: 0.72 },
  cabeceraSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
  },
  tituloSeccion: { color: '#F4F4F5', fontSize: 16, fontWeight: '700' },
  etiquetaVisual: { backgroundColor: '#242427', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  textoEtiquetaVisual: { color: '#898990', fontSize: 9, fontWeight: '700' },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  indicador: {
    width: '48%',
    minHeight: 96,
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2A2A2E',
    borderRadius: 14,
    padding: 13,
  },
  lineaIndicador: { width: 23, height: 3, borderRadius: 2 },
  valorIndicador: { color: '#F5F5F6', fontSize: 21, fontWeight: '700', marginTop: 12 },
  nombreIndicador: { color: '#A0A0A7', fontSize: 10, lineHeight: 14, marginTop: 4 },
  aclaracion: { color: '#66666D', fontSize: 10, lineHeight: 15, marginTop: 9 },
  listaAcciones: { gap: 9 },
  accion: {
    minHeight: 75,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2A2A2E',
    borderRadius: 15,
    padding: 13,
  },
  codigoAccion: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#153B32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCodigo: { color: '#5BE0BB', fontSize: 10, fontWeight: '800' },
  textoAccion: { flex: 1, marginHorizontal: 12 },
  tituloAccion: { color: '#F0F0F2', fontSize: 13, fontWeight: '700' },
  descripcionAccion: { color: '#85858D', fontSize: 10, lineHeight: 15, marginTop: 4 },
  flecha: { color: '#71717A', fontSize: 26 },
});

export default InicioAdministrador;
