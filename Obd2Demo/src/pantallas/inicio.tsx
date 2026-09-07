import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface PropiedadesInicio {
  nombreUsuario?: string;
  alAbrirEscaner: () => void;
  alCerrarSesion?: () => void;
}

export function Inicio({
  nombreUsuario = 'Conductor',
  alAbrirEscaner,
  alCerrarSesion,
}: PropiedadesInicio) {
  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
    >
      <View style={estilos.cabecera}>
        <View>
          <Text style={estilos.saludo}>Hola, {nombreUsuario}</Text>
          <Text style={estilos.fecha}>Tu centro de diagnostico SmartOBD</Text>
        </View>
        {alCerrarSesion ? (
          <Pressable
            accessibilityLabel="Cerrar sesion"
            accessibilityRole="button"
            onPress={alCerrarSesion}
            style={estilos.avatar}
          >
            <Text style={estilos.inicial}>{nombreUsuario.charAt(0).toUpperCase()}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={estilos.estadoConexion}>
        <View style={estilos.indicadorDesconectado} />
        <Text style={estilos.textoEstado}>Sin vehiculo conectado</Text>
      </View>

      <View style={estilos.tarjetaPrincipal}>
        <View style={estilos.filaSuperiorTarjeta}>
          <View style={estilos.iconoObd}>
            <View style={estilos.puertoObd} />
            <View style={estilos.pinObd} />
          </View>
          <Text style={estilos.etiquetaLista}>LISTO PARA ESCANEAR</Text>
        </View>
        <Text style={estilos.tituloPrincipal}>Conecta y entiende tu vehiculo.</Text>
        <Text style={estilos.descripcionPrincipal}>
          Busca tu adaptador ELM327, revisa codigos de falla y consulta datos del
          motor en tiempo real.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={alAbrirEscaner}
          style={({ pressed }) => [
            estilos.botonEscaner,
            pressed && estilos.presionado,
          ]}
        >
          <View style={estilos.puntoBluetooth} />
          <Text style={estilos.textoBotonEscaner}>Buscar escaner OBD-II</Text>
          <Text style={estilos.flecha}>→</Text>
        </Pressable>
      </View>

      <Text style={estilos.tituloSeccion}>Resumen del vehiculo</Text>
      <View style={estilos.cuadriculaMetricas}>
        <Metrica etiqueta="Estado" valor="Sin datos" color="#A1A1AA" />
        <Metrica etiqueta="Codigos DTC" valor="—" color="#58A6FF" />
        <Metrica etiqueta="RPM" valor="—" color="#10A37F" />
        <Metrica etiqueta="Temperatura" valor="— °C" color="#F4B860" />
      </View>

      <View style={estilos.cabeceraSeccion}>
        <Text style={estilos.tituloSeccionSinMargen}>Accesos rapidos</Text>
        <Text style={estilos.textoAuxiliar}>SmartOBD</Text>
      </View>
      <View style={estilos.listaAcciones}>
        <Accion
          codigo="01"
          titulo="Nuevo diagnostico"
          descripcion="Escanea sensores y codigos de falla"
          alPresionar={alAbrirEscaner}
        />
        <Accion
          codigo="DTC"
          titulo="Informe de fallas"
          descripcion="Interpreta alertas guardadas del motor"
          alPresionar={alAbrirEscaner}
        />
        <Accion
          codigo="VIN"
          titulo="Informacion del vehiculo"
          descripcion="Consulta identificacion y compatibilidad"
          alPresionar={alAbrirEscaner}
        />
      </View>

      <View style={estilos.nota}>
        <Text style={estilos.tituloNota}>Consejo antes de conectar</Text>
        <Text style={estilos.textoNota}>
          Enciende el contacto del vehiculo y activa Bluetooth. No necesitas
          arrancar el motor para detectar el adaptador.
        </Text>
      </View>
    </ScrollView>
  );
}

function Metrica({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: string;
  color: string;
}) {
  return (
    <View style={estilos.metrica}>
      <View style={[estilos.lineaMetrica, { backgroundColor: color }]} />
      <Text style={estilos.valorMetrica}>{valor}</Text>
      <Text style={estilos.etiquetaMetrica}>{etiqueta}</Text>
    </View>
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
      <Text style={estilos.flechaAccion}>›</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saludo: { color: '#F4F4F5', fontSize: 26, fontWeight: '700' },
  fecha: { color: '#8C8C94', marginTop: 5, fontSize: 13 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1E332E',
    borderWidth: 1,
    borderColor: '#2D5A4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { color: '#6EE7C3', fontWeight: '700', fontSize: 16 },
  estadoConexion: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 24,
    marginBottom: 14,
  },
  indicadorDesconectado: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#71717A',
  },
  textoEstado: { color: '#B8B8BE', fontSize: 12, fontWeight: '600' },
  tarjetaPrincipal: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 22,
    padding: 20,
  },
  filaSuperiorTarjeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconoObd: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: '#153B32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  puertoObd: {
    width: 17,
    height: 10,
    borderWidth: 2,
    borderColor: '#47D7AE',
    borderRadius: 3,
  },
  pinObd: {
    position: 'absolute',
    bottom: 8,
    width: 8,
    height: 2,
    backgroundColor: '#47D7AE',
  },
  etiquetaLista: { color: '#47D7AE', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  tituloPrincipal: {
    color: '#F4F4F5',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 18,
  },
  descripcionPrincipal: { color: '#A1A1AA', lineHeight: 21, marginTop: 10 },
  botonEscaner: {
    height: 52,
    backgroundColor: '#10A37F',
    borderRadius: 13,
    paddingHorizontal: 16,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  puntoBluetooth: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D4FFF3',
    marginRight: 10,
  },
  textoBotonEscaner: { flex: 1, color: '#FFFFFF', fontWeight: '700' },
  flecha: { color: '#FFFFFF', fontSize: 22 },
  presionado: { opacity: 0.72 },
  tituloSeccion: { color: '#F4F4F5', fontWeight: '700', fontSize: 17, marginTop: 28, marginBottom: 12 },
  tituloSeccionSinMargen: { color: '#F4F4F5', fontWeight: '700', fontSize: 17 },
  cuadriculaMetricas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metrica: {
    width: '48%',
    minHeight: 102,
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#29292D',
    borderRadius: 16,
    padding: 14,
  },
  lineaMetrica: { width: 22, height: 3, borderRadius: 2, marginBottom: 14 },
  valorMetrica: { color: '#F4F4F5', fontSize: 20, fontWeight: '700' },
  etiquetaMetrica: { color: '#84848C', fontSize: 12, marginTop: 5 },
  cabeceraSeccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 12,
  },
  textoAuxiliar: { color: '#64646B', fontSize: 12 },
  listaAcciones: { gap: 9 },
  accion: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#29292D',
    borderRadius: 16,
    padding: 13,
  },
  codigoAccion: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#202C37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCodigo: { color: '#75B8FF', fontFamily: 'monospace', fontWeight: '700', fontSize: 12 },
  textoAccion: { flex: 1, marginHorizontal: 12 },
  tituloAccion: { color: '#EDEDEF', fontWeight: '700', fontSize: 14 },
  descripcionAccion: { color: '#818188', fontSize: 12, lineHeight: 17, marginTop: 3 },
  flechaAccion: { color: '#71717A', fontSize: 26 },
  nota: {
    backgroundColor: '#121E1B',
    borderLeftWidth: 3,
    borderLeftColor: '#10A37F',
    borderRadius: 12,
    padding: 15,
    marginTop: 24,
  },
  tituloNota: { color: '#B8F3E3', fontWeight: '700', fontSize: 13 },
  textoNota: { color: '#8EA69F', fontSize: 12, lineHeight: 18, marginTop: 5 },
});

export default Inicio;
