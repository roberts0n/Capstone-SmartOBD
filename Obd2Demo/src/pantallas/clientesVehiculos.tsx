import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { listarClientes } from '../clientes/ServicioClientes';
import type { ClienteTaller } from '../clientes/TiposCliente';

interface Propiedades {
  busqueda: string;
  pagina: number;
  alCambiarBusqueda: (texto: string) => void;
  alCambiarPagina: (pagina: number) => void;
  alAbrirCliente: (clienteId: string) => void;
  alVolver: () => void;
}

const CLIENTES_POR_PAGINA = 20;

export function ClientesVehiculos({
  busqueda,
  pagina,
  alCambiarBusqueda,
  alCambiarPagina,
  alAbrirCliente,
  alVolver,
}: Propiedades) {
  const [clientes, establecerClientes] = useState<ClienteTaller[]>([]);
  const [haySiguiente, establecerHaySiguiente] = useState(false);
  const [cargando, establecerCargando] = useState(true);
  const [actualizando, establecerActualizando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const numeroConsulta = useRef(0);

  const cargar = useCallback(
    async (esActualizacion = false) => {
      const consulta = ++numeroConsulta.current;
      establecerError(null);
      if (esActualizacion) establecerActualizando(true);
      else establecerCargando(true);
      try {
        // pido uno extra para saber si hay otra pagina, sin contar toda la tabla
        const resultado = await listarClientes({
          busqueda,
          desde: pagina * CLIENTES_POR_PAGINA,
          limite: CLIENTES_POR_PAGINA + 1,
        });
        if (consulta !== numeroConsulta.current) return;
        establecerClientes(resultado.slice(0, CLIENTES_POR_PAGINA));
        establecerHaySiguiente(resultado.length > CLIENTES_POR_PAGINA);
      } catch (capturado) {
        if (consulta === numeroConsulta.current)
          establecerError(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudieron cargar los clientes.',
          );
      } finally {
        if (consulta === numeroConsulta.current) {
          establecerCargando(false);
          establecerActualizando(false);
        }
      }
    },
    [busqueda, pagina],
  );

  useEffect(() => {
    establecerCargando(true);
    establecerError(null);
    // espero un poco al escribir para no consultar por cada tecla
    const espera = busqueda.trim()
      ? setTimeout(() => {
          cargar().catch(() => undefined);
        }, 300)
      : undefined;
    if (!espera) cargar().catch(() => undefined);
    return () => {
      if (espera) clearTimeout(espera);
      // una respuesta anterior no debe reemplazar la busqueda nueva
      numeroConsulta.current += 1;
    };
  }, [busqueda, cargar]);

  const ocupada = cargando || actualizando;
  return (
    <View style={estilos.pantalla}>
      <View style={estilos.encabezado}>
        <View style={estilos.cabecera}>
          <Pressable
            accessibilityLabel="Volver"
            accessibilityRole="button"
            onPress={alVolver}
            style={estilos.volver}
          >
            <Text style={estilos.flechaVolver}>‹</Text>
          </Pressable>
          <Text style={estilos.titulo}>Clientes y vehículos</Text>
        </View>
        <TextInput
          accessibilityLabel="Buscar clientes"
          value={busqueda}
          onChangeText={alCambiarBusqueda}
          placeholder="Nombre, teléfono o correo"
          placeholderTextColor="#77777F"
          style={estilos.buscador}
          autoCorrect={false}
          maxLength={120}
          returnKeyType="search"
        />
      </View>
      <FlatList
        key={`${pagina}:${busqueda}`}
        data={cargando || error ? [] : clientes}
        keyExtractor={cliente => cliente.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={estilos.contenido}
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={() => cargar(true)}
            tintColor="#13C296"
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver cliente ${item.nombre}`}
            onPress={() => alAbrirCliente(item.id)}
            style={({ pressed }) => [
              estilos.tarjeta,
              pressed && estilos.presionada,
            ]}
          >
            <View style={estilos.datosCliente}>
              <Text style={estilos.nombre}>{item.nombre}</Text>
              <Text style={estilos.telefono}>
                {item.telefono ?? 'Sin teléfono registrado'}
              </Text>
            </View>
            <Text style={estilos.flecha}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator color="#13C296" style={estilos.cargando} />
          ) : error ? (
            <View style={estilos.mensaje}>
              <Text accessibilityRole="alert" style={estilos.error}>
                {error}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => cargar()}
                style={estilos.reintentar}
              >
                <Text style={estilos.textoAccion}>Intentar nuevamente</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={estilos.vacio}>
              {busqueda.trim()
                ? 'No encontramos clientes con esos datos.'
                : pagina > 0
                ? 'No hay clientes en esta página.'
                : 'Todavía no hay clientes registrados.'}
            </Text>
          )
        }
        ListFooterComponent={
          !cargando && !error && (pagina > 0 || haySiguiente) ? (
            <View style={estilos.paginacion}>
              <Pressable
                accessibilityRole="button"
                disabled={ocupada || pagina === 0}
                onPress={() => alCambiarPagina(pagina - 1)}
                style={[
                  estilos.botonPagina,
                  (ocupada || pagina === 0) && estilos.deshabilitada,
                ]}
              >
                <Text style={estilos.textoAccion}>Anterior</Text>
              </Pressable>
              <Text style={estilos.numeroPagina}>{pagina + 1}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={ocupada || !haySiguiente}
                onPress={() => alCambiarPagina(pagina + 1)}
                style={[
                  estilos.botonPagina,
                  (ocupada || !haySiguiente) && estilos.deshabilitada,
                ]}
              >
                <Text style={estilos.textoAccion}>Siguiente</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  encabezado: { paddingHorizontal: 20, paddingTop: 20 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  volver: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2C2C30',
  },
  flechaVolver: { color: '#E8E8EA', fontSize: 30, lineHeight: 31 },
  titulo: { flex: 1, color: '#F4F4F5', fontSize: 22, fontWeight: '700' },
  buscador: {
    minHeight: 50,
    color: '#F4F4F5',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  contenido: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36 },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 15,
    marginBottom: 11,
  },
  datosCliente: { flex: 1 },
  nombre: { color: '#F4F4F5', fontSize: 15, fontWeight: '700' },
  telefono: { color: '#A1A1AA', fontSize: 13, marginTop: 6 },
  flecha: { color: '#71717A', fontSize: 27, marginLeft: 12 },
  presionada: { opacity: 0.75 },
  cargando: { marginTop: 35 },
  mensaje: { paddingVertical: 20, alignItems: 'center' },
  error: { color: '#FF9C94', fontSize: 12, textAlign: 'center' },
  reintentar: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  textoAccion: { color: '#5BE0BB', fontSize: 13, fontWeight: '700' },
  vacio: { color: '#A1A1AA', fontSize: 13, textAlign: 'center', marginTop: 20 },
  paginacion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  botonPagina: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#303034',
  },
  numeroPagina: { color: '#A1A1AA', fontSize: 13 },
  deshabilitada: { opacity: 0.4 },
});
