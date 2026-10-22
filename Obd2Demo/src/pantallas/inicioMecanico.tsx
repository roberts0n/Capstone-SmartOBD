import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  listarCasosMecanico,
  type CasoMecanico,
} from '../casos/ServicioCasosMecanico';
import { MarcaSmartObd } from '../componentes/MarcaSmartObd';
import { useEstilosTematicos } from '../tema/tokensTema';
import { useTema } from '../tema/TemaAplicacion';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alAbrirCuenta: () => void;
  alAbrirEscaner: () => void;
  alAbrirCasos: () => void;
  alAbrirCaso: (casoId: string) => void;
}

interface ResumenCasos {
  pendientes: CasoMecanico[];
  enRevision: CasoMecanico[];
  diagnosticados: CasoMecanico[];
}

const RESUMEN_VACIO: ResumenCasos = {
  pendientes: [],
  enRevision: [],
  diagnosticados: [],
};

export function InicioMecanico({
  sesion,
  alAbrirCuenta,
  alAbrirEscaner,
  alAbrirCasos,
  alAbrirCaso,
}: Propiedades) {
  const estilos = useEstilosTematicos(estilosBase);
  const { colores } = useTema();
  const [resumen, establecerResumen] = useState<ResumenCasos>(RESUMEN_VACIO);
  const [cargando, establecerCargando] = useState(true);
  const [actualizando, establecerActualizando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const numeroConsulta = useRef(0);

  const cargar = useCallback(
    async (actualizar = false) => {
      const numero = ++numeroConsulta.current;
      if (actualizar) establecerActualizando(true);
      else establecerCargando(true);
      establecerError(null);
      try {
        const [pendientes, enRevision, diagnosticados] = await Promise.all([
          listarCasosMecanico(sesion, { filtro: 'pendientes', limite: 100 }),
          listarCasosMecanico(sesion, { filtro: 'en_revision', limite: 100 }),
          listarCasosMecanico(sesion, {
            filtro: 'diagnosticados',
            limite: 100,
          }),
        ]);
        if (numero !== numeroConsulta.current) return;
        establecerResumen({ pendientes, enRevision, diagnosticados });
      } catch (capturado) {
        if (numero !== numeroConsulta.current) return;
        establecerError(
          capturado instanceof Error
            ? capturado.message
            : 'No se pudo cargar tu panel de trabajo.',
        );
      } finally {
        if (numero === numeroConsulta.current) {
          establecerCargando(false);
          establecerActualizando(false);
        }
      }
    },
    [sesion],
  );

  useEffect(() => {
    cargar().catch(() => undefined);
    return () => {
      numeroConsulta.current += 1;
    };
  }, [cargar]);

  const casosActivos = useMemo(
    () => [...resumen.enRevision, ...resumen.pendientes].slice(0, 3),
    [resumen],
  );
  const proximoCaso = casosActivos[0] ?? null;

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={() => cargar(true)}
          tintColor={colores.primario}
          colors={[colores.primario]}
        />
      }
    >
      <MarcaSmartObd />
      <View style={estilos.cabecera}>
        <View style={estilos.identidad}>
          <Text style={estilos.saludo}>Hola, {sesion.nombre}</Text>
          <Text style={estilos.rol}>Mecánico</Text>
        </View>
        <Pressable
          accessibilityLabel="Abrir cuenta"
          accessibilityRole="button"
          onPress={alAbrirCuenta}
          style={({ pressed }) => [
            estilos.avatar,
            pressed && estilos.presionado,
          ]}
        >
          <Text style={estilos.inicial}>
            {sesion.nombre.charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <View style={estilos.tarjetaPrincipal}>
        <View style={estilos.encabezadoTarjeta}>
          <View style={estilos.acento} />
          <Text style={estilos.etiquetaPrincipal}>
            {proximoCaso?.estado === 'en_revision'
              ? 'REVISIÓN EN CURSO'
              : 'PRÓXIMO TRABAJO'}
          </Text>
        </View>
        <Text style={estilos.tituloPrincipal}>
          {proximoCaso?.vehiculo ?? 'Tu bandeja está al día'}
        </Text>
        <Text style={estilos.descripcionPrincipal}>
          {proximoCaso
            ? `${proximoCaso.patente} · ${proximoCaso.cliente}`
            : 'No tienes casos pendientes ni revisiones activas por el momento.'}
        </Text>
        {proximoCaso ? (
          <Text numberOfLines={2} style={estilos.motivoPrincipal}>
            {proximoCaso.motivoIngreso}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            proximoCaso ? alAbrirCaso(proximoCaso.id) : alAbrirCasos()
          }
          style={({ pressed }) => [
            estilos.botonPrincipal,
            pressed && estilos.presionado,
          ]}
        >
          <Text style={estilos.textoBotonPrincipal}>
            {proximoCaso ? 'Abrir caso' : 'Ver mis casos'}
          </Text>
          <Text accessible={false} style={estilos.flechaPrincipal}>
            →
          </Text>
        </Pressable>
      </View>

      <View style={estilos.filaSeccion}>
        <Text style={estilos.tituloSeccion}>Mi trabajo</Text>
        <Pressable accessibilityRole="button" onPress={alAbrirCasos}>
          <Text style={estilos.enlace}>Ver todos</Text>
        </Pressable>
      </View>

      {cargando ? (
        <View style={estilos.panelCarga}>
          <ActivityIndicator color={colores.primario} />
          <Text style={estilos.textoSecundario}>Cargando casos asignados…</Text>
        </View>
      ) : error ? (
        <View style={estilos.panelMensaje}>
          <Text accessibilityRole="alert" style={estilos.textoError}>
            {error}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => cargar()}>
            <Text style={estilos.enlace}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={estilos.resumen}>
            <Indicador
              color="#58A6FF"
              cantidad={resumen.pendientes.length}
              etiqueta="Pendientes"
            />
            <Indicador
              color="#F4B860"
              cantidad={resumen.enRevision.length}
              etiqueta="En revisión"
            />
            <Indicador
              color="#4ED88A"
              cantidad={resumen.diagnosticados.length}
              etiqueta="Finalizados"
            />
          </View>

          <View style={estilos.listaCasos}>
            {casosActivos.length ? (
              casosActivos.map(caso => (
                <TarjetaCaso
                  key={caso.id}
                  caso={caso}
                  alAbrir={() => alAbrirCaso(caso.id)}
                />
              ))
            ) : (
              <View style={estilos.panelMensaje}>
                <Text style={estilos.tituloVacio}>No hay trabajo activo</Text>
                <Text style={estilos.textoSecundario}>
                  Los casos que te asignen aparecerán aquí automáticamente.
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      <Pressable
        accessibilityLabel="Conectar escáner OBD-II"
        accessibilityRole="button"
        onPress={alAbrirEscaner}
        style={({ pressed }) => [
          estilos.accesoEscaner,
          pressed && estilos.presionado,
        ]}
      >
        <View style={estilos.iconoEscaner}>
          <Text style={estilos.textoIcono}>OBD</Text>
        </View>
        <View style={estilos.textoAcceso}>
          <Text style={estilos.tituloAcceso}>Escáner OBD-II</Text>
          <Text style={estilos.textoSecundario}>
            Prepara la conexión para revisar un vehículo
          </Text>
        </View>
        <Text accessible={false} style={estilos.flechaAcceso}>
          ›
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Indicador({
  color,
  cantidad,
  etiqueta,
}: {
  color: string;
  cantidad: number;
  etiqueta: string;
}) {
  const estilos = useEstilosTematicos(estilosBase);
  return (
    <View style={estilos.indicador}>
      <View style={[estilos.lineaIndicador, { backgroundColor: color }]} />
      <Text style={estilos.numeroIndicador}>{cantidad}</Text>
      <Text style={estilos.etiquetaIndicador}>{etiqueta}</Text>
    </View>
  );
}

function TarjetaCaso({
  caso,
  alAbrir,
}: {
  caso: CasoMecanico;
  alAbrir: () => void;
}) {
  const estilos = useEstilosTematicos(estilosBase);
  return (
    <Pressable
      accessibilityLabel={`Abrir caso de ${caso.vehiculo}`}
      accessibilityRole="button"
      onPress={alAbrir}
      style={({ pressed }) => [
        estilos.tarjetaCaso,
        pressed && estilos.presionado,
      ]}
    >
      <View style={estilos.filaCaso}>
        <View style={estilos.datosCaso}>
          <Text numberOfLines={1} style={estilos.vehiculo}>
            {caso.vehiculo}
          </Text>
          <Text style={estilos.datosVehiculo}>
            {caso.cliente} · {caso.patente}
          </Text>
          <Text numberOfLines={1} style={estilos.motivoCaso}>
            {caso.motivoIngreso}
          </Text>
        </View>
        <View style={estilos.estadoCaso}>
          <Text style={estilos.textoEstado}>
            {caso.estado === 'en_revision' ? 'EN REVISIÓN' : 'PENDIENTE'}
          </Text>
        </View>
        <Text accessible={false} style={estilos.flechaCaso}>
          ›
        </Text>
      </View>
    </Pressable>
  );
}

const estilosBase = StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
    contenido: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 34 },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    identidad: { flex: 1, paddingRight: 16 },
    saludo: {
      color: '#F4F4F5',
      fontSize: 25,
      lineHeight: 32,
      fontWeight: '700',
    },
    rol: { color: '#96969D', fontSize: 12, marginTop: 5 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: '#153B32',
      alignItems: 'center',
      justifyContent: 'center',
    },
    inicial: { color: '#287FFF', fontSize: 18, fontWeight: '800' },
    tarjetaPrincipal: {
      overflow: 'hidden',
      backgroundColor: '#071329',
      borderColor: '#132442',
      borderWidth: 1,
      borderRadius: 24,
      padding: 21,
    },
    encabezadoTarjeta: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    acento: {
      width: 19,
      height: 3,
      borderRadius: 2,
      backgroundColor: '#287FFF',
    },
    etiquetaPrincipal: {
      color: '#8EBBFF',
      fontSize: 10,
      lineHeight: 15,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    tituloPrincipal: {
      color: '#FEFEFE',
      fontSize: 24,
      lineHeight: 31,
      fontWeight: '800',
      marginTop: 16,
    },
    descripcionPrincipal: {
      color: '#C8D8EE',
      fontSize: 13,
      lineHeight: 20,
      marginTop: 7,
    },
    motivoPrincipal: {
      color: '#A9BAD3',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 9,
    },
    botonPrincipal: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#287FFF',
      borderRadius: 14,
      paddingHorizontal: 16,
      marginTop: 20,
    },
    textoBotonPrincipal: {
      flex: 1,
      color: '#FEFEFE',
      fontSize: 14,
      fontWeight: '800',
    },
    flechaPrincipal: { color: '#FEFEFE', fontSize: 22 },
    filaSeccion: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 27,
      marginBottom: 13,
    },
    tituloSeccion: {
      color: '#F4F4F5',
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
    },
    enlace: { color: '#58A6FF', fontSize: 12, fontWeight: '700' },
    panelCarga: {
      minHeight: 88,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 18,
    },
    panelMensaje: {
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 18,
      padding: 17,
      gap: 7,
    },
    textoSecundario: { color: '#96969D', fontSize: 12, lineHeight: 18 },
    textoError: { color: '#FF9C94', fontSize: 12, lineHeight: 18 },
    resumen: { flexDirection: 'row', gap: 9 },
    indicador: {
      flex: 1,
      minWidth: 0,
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 17,
      padding: 13,
    },
    lineaIndicador: { width: 23, height: 3, borderRadius: 2 },
    numeroIndicador: {
      color: '#F4F4F5',
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      marginTop: 10,
    },
    etiquetaIndicador: {
      color: '#96969D',
      fontSize: 10,
      lineHeight: 14,
      marginTop: 3,
    },
    listaCasos: { gap: 10, marginTop: 12 },
    tarjetaCaso: {
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 18,
      padding: 15,
    },
    filaCaso: { flexDirection: 'row', alignItems: 'center' },
    datosCaso: { flex: 1, minWidth: 0 },
    vehiculo: { color: '#F4F4F5', fontSize: 14, fontWeight: '800' },
    datosVehiculo: { color: '#96969D', fontSize: 11, marginTop: 5 },
    motivoCaso: { color: '#96969D', fontSize: 11, marginTop: 7 },
    estadoCaso: {
      backgroundColor: '#153B32',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 6,
      marginLeft: 9,
    },
    textoEstado: { color: '#287FFF', fontSize: 8, fontWeight: '800' },
    flechaCaso: { color: '#96969D', fontSize: 21, marginLeft: 8 },
    tituloVacio: { color: '#F4F4F5', fontSize: 14, fontWeight: '800' },
    accesoEscaner: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 18,
      padding: 14,
      marginTop: 17,
    },
    iconoEscaner: {
      width: 47,
      height: 47,
      borderRadius: 15,
      backgroundColor: '#153B32',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textoIcono: { color: '#287FFF', fontSize: 10, fontWeight: '900' },
    textoAcceso: { flex: 1, marginHorizontal: 13 },
    tituloAcceso: {
      color: '#F4F4F5',
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 3,
    },
    flechaAcceso: { color: '#96969D', fontSize: 25 },
    presionado: { opacity: 0.72 },
  });

export default InicioMecanico;
