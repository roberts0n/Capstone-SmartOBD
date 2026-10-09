import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  listarCasosRecepcion,
  type CasoRecepcion,
} from '../casos/ServicioCasosRecepcion';
import type { EstadoCasoDiagnostico } from '../casos/TiposCasoDiagnostico';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alAbrirCuenta: () => void;
  alAbrirNuevaOrden: () => void;
  alAbrirCasos: () => void;
}

export function InicioRecepcion({
  sesion,
  alAbrirCuenta,
  alAbrirNuevaOrden,
  alAbrirCasos,
}: Propiedades) {
  const [casos, establecerCasos] = useState<CasoRecepcion[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [actualizando, establecerActualizando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);

  const cargar = useCallback(async (esActualizacion = false) => {
    if (esActualizacion) establecerActualizando(true);
    else establecerCargando(true);
    establecerError(null);

    try {
      establecerCasos(await listarCasosRecepcion());
    } catch (capturado) {
      establecerError(
        capturado instanceof Error
          ? capturado.message
          : 'No pudimos cargar los ingresos del taller.',
      );
    } finally {
      establecerCargando(false);
      establecerActualizando(false);
    }
  }, []);

  useEffect(() => {
    cargar().catch(() => undefined);
  }, [cargar]);

  const resumen = useMemo(() => {
    const ahora = new Date();
    const ingresosHoy = casos.filter(caso => mismaFecha(caso.creadoEn, ahora));
    const casosAbiertos = casos.filter(caso => caso.estado !== 'cerrado');

    return {
      ingresosHoy: ingresosHoy.length,
      casosAbiertos: casosAbiertos.length,
      ultimosIngresos: casos.slice(0, 5),
    };
  }, [casos]);

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={() => cargar(true)}
          tintColor="#13C296"
        />
      }
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
    >
      <Cabecera sesion={sesion} alAbrirCuenta={alAbrirCuenta} />

      <View style={estilos.tarjetaOrden}>
        <Text style={estilos.tituloOrden}>Nueva orden de trabajo</Text>
        <Text style={estilos.descripcionOrden}>
          Selecciona al cliente, su vehículo y registra el motivo de ingreso.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={alAbrirNuevaOrden}
          style={({ pressed }) => [
            estilos.botonOrden,
            pressed && estilos.presionado,
          ]}
        >
          <Text style={estilos.simboloAgregar}>＋</Text>
          <Text style={estilos.textoBoton}>Crear orden</Text>
        </Pressable>
      </View>

      <View style={estilos.cabeceraSeccion}>
        <Text style={estilos.tituloSeccion}>Resumen de hoy</Text>
        <Text style={estilos.auxiliar}>Hoy</Text>
      </View>

      {cargando ? (
        <View style={estilos.cargando}>
          <ActivityIndicator color="#13C296" />
          <Text style={estilos.textoCargando}>Cargando ingresos...</Text>
        </View>
      ) : (
        <View style={estilos.filaResumen}>
          <Metrica
            valor={String(resumen.ingresosHoy)}
            etiqueta="Ingresos"
            detalle="registrados hoy"
          />
          <Metrica
            valor={String(resumen.casosAbiertos)}
            etiqueta="Casos abiertos"
            detalle="pendientes de cierre"
          />
        </View>
      )}

      <View style={estilos.cabeceraSeccion}>
        <Text style={estilos.tituloSeccion}>Últimos ingresos</Text>
        <Pressable
          accessibilityRole="button"
          onPress={alAbrirCasos}
          hitSlop={8}
        >
          <Text style={estilos.verTodos}>Ver todos</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={estilos.estadoVacio}>
          <Text accessibilityRole="alert" style={estilos.textoError}>
            {error}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => cargar()}>
            <Text style={estilos.reintentar}>Intentar nuevamente</Text>
          </Pressable>
        </View>
      ) : !cargando && resumen.ultimosIngresos.length === 0 ? (
        <View style={estilos.estadoVacio}>
          <Text style={estilos.tituloVacio}>Aún no hay ingresos</Text>
          <Text style={estilos.textoVacio}>
            Cuando se cree una orden, el vehículo aparecerá aquí.
          </Text>
        </View>
      ) : (
        <View style={estilos.lista}>
          {resumen.ultimosIngresos.map(caso => (
            <Ingreso key={caso.id} caso={caso} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Cabecera({
  sesion,
  alAbrirCuenta,
}: {
  sesion: SesionTaller;
  alAbrirCuenta: () => void;
}) {
  return (
    <>
      <View style={estilos.cabecera}>
        <View style={estilos.identidad}>
          <Text style={estilos.taller}>{sesion.taller}</Text>
          <Text style={estilos.saludo}>Hola, {primerNombre(sesion.nombre)}</Text>
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
      <View style={estilos.etiquetaPerfil}>
        <Text style={estilos.textoPerfil}>Recepción</Text>
      </View>
    </>
  );
}

function Metrica({
  valor,
  etiqueta,
  detalle,
}: {
  valor: string;
  etiqueta: string;
  detalle: string;
}) {
  return (
    <View style={estilos.metrica}>
      <Text style={estilos.valorMetrica}>{valor}</Text>
      <Text style={estilos.etiquetaMetrica}>{etiqueta}</Text>
      <Text style={estilos.detalleMetrica}>{detalle}</Text>
    </View>
  );
}

function Ingreso({ caso }: { caso: CasoRecepcion }) {
  const presentacion = presentarEstado(caso.estado);

  return (
    <View style={estilos.ingreso}>
      <View style={estilos.datosIngreso}>
        <Text style={estilos.vehiculo} numberOfLines={1}>
          {caso.vehiculo}
        </Text>
        <Text style={estilos.cliente} numberOfLines={1}>
          {caso.cliente} · {caso.patente}
        </Text>
        <View style={estilos.filaEstado}>
          <View
            style={[estilos.puntoEstado, { backgroundColor: presentacion.color }]}
          />
          <Text style={[estilos.estado, { color: presentacion.color }]}>
            {presentacion.nombre}
          </Text>
        </View>
      </View>
      <View style={estilos.datosDerecha}>
        <Text style={estilos.hora}>{formatearIngreso(caso.creadoEn)}</Text>
        <Text style={estilos.mecanico} numberOfLines={1}>
          {caso.mecanico ?? 'Sin asignar'}
        </Text>
      </View>
    </View>
  );
}

function presentarEstado(
  estado: EstadoCasoDiagnostico,
): { nombre: string; color: string } {
  const estados: Record<
    EstadoCasoDiagnostico,
    { nombre: string; color: string }
  > = {
    ingresado: { nombre: 'Ingresado', color: '#A1A1AA' },
    diagnostico_inicial: { nombre: 'Diagnóstico inicial', color: '#5EB4FF' },
    asignado: { nombre: 'Asignado', color: '#C7A6FF' },
    en_revision: { nombre: 'En revisión', color: '#F4B860' },
    diagnosticado: { nombre: 'Diagnosticado', color: '#43D6AE' },
    cerrado: { nombre: 'Cerrado', color: '#7B7B83' },
  };
  return estados[estado];
}

function mismaFecha(fecha: string, referencia: Date): boolean {
  const valor = new Date(fecha);
  return (
    valor.getFullYear() === referencia.getFullYear() &&
    valor.getMonth() === referencia.getMonth() &&
    valor.getDate() === referencia.getDate()
  );
}

function formatearIngreso(fecha: string): string {
  const valor = new Date(fecha);
  if (mismaFecha(fecha, new Date())) {
    return new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(valor);
  }
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
  }).format(valor);
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 42 },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identidad: { flex: 1, paddingRight: 12 },
  taller: {
    color: '#10A37F',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  saludo: { color: '#F4F4F5', fontSize: 25, fontWeight: '700', marginTop: 5 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#153B32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { color: '#5BE0BB', fontWeight: '700', fontSize: 15 },
  etiquetaPerfil: {
    alignSelf: 'flex-start',
    backgroundColor: '#10352C',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginTop: 9,
  },
  textoPerfil: { color: '#53D9B4', fontSize: 11, fontWeight: '700' },
  tarjetaOrden: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 19,
    padding: 17,
    marginTop: 19,
  },
  tituloOrden: { color: '#F4F4F5', fontSize: 17, fontWeight: '700' },
  descripcionOrden: { color: '#96969D', fontSize: 12, lineHeight: 18, marginTop: 8 },
  botonOrden: {
    minHeight: 46,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 23,
    marginBottom: 10,
  },
  tituloSeccion: { color: '#F4F4F5', fontSize: 16, fontWeight: '700' },
  auxiliar: { color: '#68686F', fontSize: 10 },
  verTodos: { color: '#39CDA7', fontSize: 11, fontWeight: '700' },
  filaResumen: { flexDirection: 'row', gap: 9 },
  metrica: {
    flex: 1,
    minHeight: 95,
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2A2A2E',
    borderRadius: 14,
    padding: 13,
  },
  valorMetrica: { color: '#F5F5F6', fontSize: 21, fontWeight: '700' },
  etiquetaMetrica: { color: '#E4E4E7', fontSize: 11, fontWeight: '700', marginTop: 5 },
  detalleMetrica: { color: '#73737B', fontSize: 9, marginTop: 3 },
  cargando: {
    minHeight: 95,
    backgroundColor: '#171719',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  textoCargando: { color: '#8D8D94', fontSize: 11 },
  lista: { gap: 8 },
  ingreso: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2A2A2E',
    borderRadius: 14,
    padding: 12,
  },
  datosIngreso: { flex: 1, paddingRight: 10 },
  vehiculo: { color: '#F0F0F2', fontSize: 13, fontWeight: '700' },
  cliente: { color: '#85858D', fontSize: 10, marginTop: 4 },
  filaEstado: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  puntoEstado: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  estado: { fontSize: 9, fontWeight: '700' },
  datosDerecha: { maxWidth: '34%', alignItems: 'flex-end' },
  hora: { color: '#68686F', fontSize: 9 },
  mecanico: { color: '#A5A5AB', fontSize: 9, marginTop: 8 },
  estadoVacio: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2A2A2E',
    borderRadius: 14,
    padding: 17,
  },
  tituloVacio: { color: '#E5E5E7', fontSize: 13, fontWeight: '700' },
  textoVacio: { color: '#85858D', fontSize: 11, lineHeight: 17, marginTop: 5 },
  textoError: { color: '#FF817A', fontSize: 11, lineHeight: 17 },
  reintentar: { color: '#53D9B4', fontSize: 11, fontWeight: '700', marginTop: 10 },
});

export default InicioRecepcion;
