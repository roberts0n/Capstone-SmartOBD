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
import {
  listarCasosAsignadosRecepcion,
  type CasoAsignadoRecepcion,
} from '../casos/ServicioCasosRecepcion';

interface Propiedades {
  alVolver: () => void;
}

export function CasosAsignados({ alVolver }: Propiedades) {
  const [casos, establecerCasos] = useState<CasoAsignadoRecepcion[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [actualizando, establecerActualizando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);

  const cargar = useCallback(async (esActualizacion = false) => {
    if (esActualizacion) establecerActualizando(true);
    else establecerCargando(true);
    establecerError(null);
    try {
      establecerCasos(await listarCasosAsignadosRecepcion());
    } catch (capturado) {
      establecerError(
        capturado instanceof Error
          ? capturado.message
          : 'No se pudieron cargar los casos.',
      );
    } finally {
      establecerCargando(false);
      establecerActualizando(false);
    }
  }, []);

  useEffect(() => {
    cargar().catch(() => undefined);
  }, [cargar]);

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={actualizando} onRefresh={() => cargar(true)} tintColor="#13C296" />}
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
    >
      <View style={estilos.cabecera}>
        <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={alVolver} style={estilos.volver}>
          <Text style={estilos.flechaVolver}>‹</Text>
        </Pressable>
        <View>
          <Text style={estilos.seccion}>Recepción</Text>
          <Text style={estilos.titulo}>Casos asignados</Text>
        </View>
      </View>

      <Text style={estilos.descripcion}>
        Revisa si el mecánico ya realizó la evaluación del vehículo.
      </Text>

      {cargando ? (
        <ActivityIndicator color="#13C296" style={estilos.cargando} />
      ) : error ? (
        <View style={estilos.mensaje}>
          <Text accessibilityRole="alert" style={estilos.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => cargar()}>
            <Text style={estilos.reintentar}>Intentar nuevamente</Text>
          </Pressable>
        </View>
      ) : casos.length === 0 ? (
        <View style={estilos.mensaje}>
          <Text style={estilos.sinCasos}>Todavía no hay casos asignados.</Text>
        </View>
      ) : (
        <View style={estilos.lista}>
          {casos.map(caso => <TarjetaCaso caso={caso} key={caso.id} />)}
        </View>
      )}
    </ScrollView>
  );
}

function TarjetaCaso({ caso }: { caso: CasoAsignadoRecepcion }) {
  const revisado = caso.estado === 'revisado';
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.filaSuperior}>
        <Text style={estilos.cliente}>{caso.cliente}</Text>
        <View style={[estilos.estado, revisado ? estilos.estadoRevisado : estilos.estadoPendiente]}>
          <View style={[estilos.punto, revisado ? estilos.puntoRevisado : estilos.puntoPendiente]} />
          <Text style={[estilos.textoEstado, revisado ? estilos.textoRevisado : estilos.textoPendiente]}>
            {revisado ? 'Ha sido revisado' : 'No ha sido revisado'}
          </Text>
        </View>
      </View>
      <Text style={estilos.vehiculo}>{caso.vehiculo}</Text>
      <Text style={estilos.patente}>{caso.patente}</Text>
      <View style={estilos.separador} />
      <View style={estilos.filaDato}>
        <Text style={estilos.etiquetaDato}>Mecánico</Text>
        <Text style={estilos.valorDato}>{caso.mecanico}</Text>
      </View>
      <View style={estilos.filaDato}>
        <Text style={estilos.etiquetaDato}>Ingreso</Text>
        <Text style={estilos.valorDato}>{formatearFecha(caso.creadoEn)}</Text>
      </View>
    </View>
  );
}

function formatearFecha(fecha: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fecha));
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  volver: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#171719', borderWidth: 1, borderColor: '#2C2C30' },
  flechaVolver: { color: '#E8E8EA', fontSize: 30, lineHeight: 31 },
  seccion: { color: '#13C296', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  titulo: { color: '#F4F4F5', fontSize: 23, fontWeight: '700' },
  descripcion: { color: '#909098', fontSize: 13, lineHeight: 19, marginTop: 18 },
  cargando: { marginTop: 50 },
  mensaje: { alignItems: 'center', backgroundColor: '#171719', borderWidth: 1, borderColor: '#2D2D31', borderRadius: 15, padding: 22, marginTop: 24 },
  sinCasos: { color: '#96969D', fontSize: 13 },
  error: { color: '#FF9C94', fontSize: 12, textAlign: 'center' },
  reintentar: { color: '#4DDBB7', fontSize: 12, fontWeight: '700', marginTop: 12 },
  lista: { gap: 11, marginTop: 22 },
  tarjeta: { backgroundColor: '#171719', borderWidth: 1, borderColor: '#2D2D31', borderRadius: 16, padding: 15 },
  filaSuperior: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cliente: { flex: 1, color: '#F1F1F3', fontSize: 15, fontWeight: '700' },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  estadoPendiente: { backgroundColor: '#312316' },
  estadoRevisado: { backgroundColor: '#102B23' },
  punto: { width: 7, height: 7, borderRadius: 4 },
  puntoPendiente: { backgroundColor: '#F59E42' },
  puntoRevisado: { backgroundColor: '#20C997' },
  textoEstado: { fontSize: 10, fontWeight: '700' },
  textoPendiente: { color: '#F8B76B' },
  textoRevisado: { color: '#66DFBD' },
  vehiculo: { color: '#C7C7CC', fontSize: 13, marginTop: 10 },
  patente: { color: '#13C296', fontSize: 12, fontWeight: '700', marginTop: 4 },
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: '#303034', marginVertical: 12 },
  filaDato: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 5 },
  etiquetaDato: { color: '#85858C', fontSize: 11 },
  valorDato: { flex: 1, color: '#D7D7DB', fontSize: 11, textAlign: 'right' },
});

export default CasosAsignados;
