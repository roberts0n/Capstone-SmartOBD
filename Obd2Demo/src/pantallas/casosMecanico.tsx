import { useEstilosTematicos } from '../tema/tokensTema';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  listarCasosMecanico,
  type CasoMecanico,
  type ConsultaCasosMecanico,
} from '../casos/ServicioCasosMecanico';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alAbrirCaso: (casoId: string) => void;
  consultaInicial?: ConsultaCasosMecanico;
  alCambiarConsulta: (consulta: ConsultaCasosMecanico) => void;
}

export function CasosMecanico({
  sesion,
  alAbrirCaso,
  consultaInicial,
  alCambiarConsulta,
}: Propiedades) {
  const estilos = useEstilosTematicos(estilosBase);
  const [busqueda, establecerBusqueda] = useState(
    consultaInicial?.busqueda ?? '',
  );
  const [filtro, establecerFiltro] = useState<
    NonNullable<ConsultaCasosMecanico['filtro']>
  >(consultaInicial?.filtro ?? 'pendientes');
  const [pagina, establecerPagina] = useState(
    Math.floor((consultaInicial?.desde ?? 0) / 20),
  );
  const [casos, establecerCasos] = useState<CasoMecanico[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [actualizando, establecerActualizando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const [haySiguiente, establecerHaySiguiente] = useState(false);
  const numeroConsulta = useRef(0);
  const abriendo = useRef(false);

  useEffect(() => {
    alCambiarConsulta({ busqueda, filtro, desde: pagina * 20 });
  }, [busqueda, filtro, pagina, alCambiarConsulta]);

  const cargar = useCallback(
    async (actualizar = false) => {
      const numero = ++numeroConsulta.current;
      if (actualizar) establecerActualizando(true);
      else establecerCargando(true);
      establecerError(null);
      try {
        const resultado = await listarCasosMecanico(sesion, {
          busqueda,
          filtro,
          desde: pagina * 20,
          limite: 21,
        });
        if (numero !== numeroConsulta.current) return;
        establecerCasos(resultado.slice(0, 20));
        establecerHaySiguiente(resultado.length > 20);
      } catch (capturado) {
        if (numero === numeroConsulta.current)
          establecerError(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudieron consultar tus casos.',
          );
      } finally {
        if (numero === numeroConsulta.current) {
          establecerCargando(false);
          establecerActualizando(false);
        }
      }
    },
    [sesion, busqueda, filtro, pagina],
  );

  useEffect(() => {
    establecerCargando(true);
    abriendo.current = false;
    const espera = setTimeout(
      () => {
        cargar().catch(() => undefined);
      },
      busqueda.trim() ? 300 : 0,
    );
    return () => {
      clearTimeout(espera);
      numeroConsulta.current += 1;
    };
  }, [busqueda, cargar]);

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={() => cargar(true)}
          tintColor="#287FFF"
        />
      }
    >
      <Text style={estilos.titulo}>Mis casos</Text>
      <TextInput
        accessibilityLabel="Buscar mis casos"
        placeholder="Cliente, patente o vehículo"
        placeholderTextColor="#77777F"
        value={busqueda}
        maxLength={120}
        autoCorrect={false}
        style={estilos.buscador}
        onChangeText={texto => {
          establecerBusqueda(texto);
          establecerPagina(0);
        }}
      />
      <View style={estilos.filtros}>
        {(['pendientes', 'en_revision', 'diagnosticados'] as const).map(
          opcion => (
            <Pressable
              key={opcion}
              accessibilityRole="button"
              accessibilityLabel={`Filtro ${opcion}`}
              accessibilityState={{ selected: filtro === opcion }}
              onPress={() => {
                establecerFiltro(opcion);
                establecerPagina(0);
              }}
              style={[
                estilos.filtro,
                filtro === opcion && estilos.filtroActivo,
              ]}
            >
              <Text
                style={[
                  estilos.textoFiltro,
                  filtro === opcion && estilos.textoFiltroActivo,
                ]}
              >
                {opcion === 'pendientes'
                  ? 'Pendientes'
                  : opcion === 'en_revision'
                  ? 'En revisión'
                  : 'Diagnosticados'}
              </Text>
            </Pressable>
          ),
        )}
      </View>
      {cargando ? (
        <ActivityIndicator color="#287FFF" style={estilos.cargando} />
      ) : error ? (
        <View style={estilos.mensaje}>
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => cargar()}>
            <Text style={estilos.enlace}>Reintentar</Text>
          </Pressable>
        </View>
      ) : !casos.length ? (
        <View style={estilos.mensaje}>
          <Text style={estilos.secundario}>
            No hay casos para esta consulta.
          </Text>
        </View>
      ) : (
        <View style={estilos.lista}>
          {casos.map(caso => (
            <Pressable
              key={caso.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir caso ${caso.id}`}
              style={({ pressed }) => [
                estilos.tarjeta,
                pressed && estilos.presionada,
              ]}
              onPress={() => {
                if (abriendo.current) return;
                abriendo.current = true;
                // el detalle vuelve a consultar el caso y su permiso antes de mostrarlo
                alAbrirCaso(caso.id);
              }}
            >
              <View style={estilos.fila}>
                <Text style={estilos.vehiculo}>{caso.vehiculo}</Text>
                <Text style={estilos.estado}>
                  {caso.estado === 'asignado'
                    ? 'Pendiente'
                    : caso.estado === 'en_revision'
                    ? 'En revisión'
                    : 'Diagnosticado'}
                </Text>
              </View>
              <Text style={estilos.patente}>{caso.patente}</Text>
              <Text style={estilos.cliente}>{caso.cliente}</Text>
              <Text numberOfLines={2} style={estilos.motivo}>
                {caso.motivoIngreso}
              </Text>
              <Text style={estilos.prioridad}>Prioridad {caso.prioridad}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!cargando && !error ? (
        <View style={estilos.paginacion}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Página anterior"
            disabled={pagina === 0 || actualizando}
            onPress={() => {
              if (pagina > 0) establecerPagina(actual => actual - 1);
            }}
          >
            <Text
              style={[
                estilos.enlace,
                (pagina === 0 || actualizando) && estilos.deshabilitado,
              ]}
            >
              Anterior
            </Text>
          </Pressable>
          <Text style={estilos.secundario}>Página {pagina + 1}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Página siguiente"
            disabled={!haySiguiente || actualizando}
            onPress={() => {
              if (haySiguiente) establecerPagina(actual => actual + 1);
            }}
          >
            <Text
              style={[
                estilos.enlace,
                (!haySiguiente || actualizando) && estilos.deshabilitado,
              ]}
            >
              Siguiente
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const estilosBase = StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
    contenido: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },
    titulo: {
      color: '#F4F4F5',
      fontSize: 26,
      fontWeight: '700',
      marginBottom: 22,
    },
    buscador: {
      minHeight: 48,
      color: '#F4F4F5',
      backgroundColor: '#171719',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#303034',
      paddingHorizontal: 13,
    },
    filtros: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginVertical: 15,
    },
    filtro: {
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 9,
      backgroundColor: '#27272B',
    },
    filtroActivo: { backgroundColor: '#176B56' },
    textoFiltro: { color: '#F4F4F5', fontSize: 12 },
    textoFiltroActivo: { color: '#FEFEFE', fontWeight: '700' },
    cargando: { marginTop: 40 },
    lista: { gap: 11 },
    tarjeta: {
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#2D2D31',
      borderRadius: 15,
      padding: 15,
    },
    fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    vehiculo: { flex: 1, color: '#F1F1F3', fontSize: 15, fontWeight: '700' },
    estado: { color: '#66DFBD', fontSize: 11 },
    patente: {
      color: '#13C296',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 6,
    },
    cliente: { color: '#C7C7CC', fontSize: 13, marginTop: 10 },
    motivo: { color: '#96969D', fontSize: 12, lineHeight: 18, marginTop: 8 },
    prioridad: { color: '#96969D', fontSize: 11, marginTop: 12 },
    mensaje: {
      padding: 22,
      borderRadius: 15,
      backgroundColor: '#171719',
      gap: 12,
    },
    secundario: { color: '#96969D', fontSize: 13 },
    error: { color: '#FF9C94', fontSize: 12 },
    enlace: {
      color: '#4DDBB7',
      fontSize: 12,
      fontWeight: '700',
      paddingVertical: 8,
    },
    paginacion: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
    },
    deshabilitado: { opacity: 0.4 },
    presionada: { opacity: 0.75 },
  });
