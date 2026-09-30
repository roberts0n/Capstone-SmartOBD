import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { listarClientes } from '../clientes/ServicioClientes';
import type { ClienteTaller } from '../clientes/TiposCliente';
import { listarVehiculosCliente } from '../vehiculos/ServicioVehiculos';
import type { VehiculoTaller } from '../vehiculos/TiposVehiculo';

interface Propiedades {
  alVolver: () => void;
  alContinuar: (orden: BorradorOrdenTrabajo) => void;
}

export interface BorradorOrdenTrabajo {
  cliente: ClienteTaller;
  vehiculo: VehiculoTaller;
  motivoIngreso: string;
}

export function NuevaOrdenTrabajo({ alVolver, alContinuar }: Propiedades) {
  const [clientes, establecerClientes] = useState<ClienteTaller[]>([]);
  const [busqueda, establecerBusqueda] = useState('');
  const [cliente, establecerCliente] = useState<ClienteTaller | null>(null);
  const [vehiculos, establecerVehiculos] = useState<VehiculoTaller[]>([]);
  const [vehiculo, establecerVehiculo] = useState<VehiculoTaller | null>(null);
  const [motivo, establecerMotivo] = useState('');
  const [cargandoClientes, establecerCargandoClientes] = useState(true);
  const [cargandoVehiculos, establecerCargandoVehiculos] = useState(false);
  const [error, establecerError] = useState<string | null>(null);

  useEffect(() => {
    let activa = true;
    listarClientes()
      .then(resultado => {
        if (activa) establecerClientes(resultado);
      })
      .catch(capturado => {
        if (activa) {
          establecerError(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudieron cargar los clientes.',
          );
        }
      })
      .finally(() => {
        if (activa) establecerCargandoClientes(false);
      });
    return () => {
      activa = false;
    };
  }, []);

  const coincidencias = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto || cliente) return [];
    return clientes
      .filter(item =>
        [item.nombre, item.correo ?? '', item.telefono ?? ''].some(valor =>
          valor.toLowerCase().includes(texto),
        ),
      )
      .slice(0, 5);
  }, [busqueda, cliente, clientes]);

  async function seleccionarCliente(seleccionado: ClienteTaller) {
    establecerCliente(seleccionado);
    establecerBusqueda(seleccionado.nombre);
    establecerVehiculo(null);
    establecerCargandoVehiculos(true);
    establecerError(null);
    try {
      establecerVehiculos(await listarVehiculosCliente(seleccionado.id));
    } catch (capturado) {
      establecerError(
        capturado instanceof Error
          ? capturado.message
          : 'No se pudieron cargar los vehículos del cliente.',
      );
    } finally {
      establecerCargandoVehiculos(false);
    }
  }

  function limpiarCliente() {
    establecerCliente(null);
    establecerVehiculos([]);
    establecerVehiculo(null);
    establecerBusqueda('');
  }

  function continuar() {
    if (!cliente) {
      establecerError('Selecciona un cliente registrado.');
      return;
    }
    if (!vehiculo) {
      establecerError('Selecciona uno de los vehículos del cliente.');
      return;
    }
    if (motivo.trim().length < 3) {
      establecerError('Describe brevemente el motivo de ingreso.');
      return;
    }
    establecerError(null);
    alContinuar({
      cliente,
      vehiculo,
      motivoIngreso: motivo.trim(),
    });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.pantalla}
    >
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        <Cabecera alVolver={alVolver} />

        <Text style={estilos.etiqueta}>Cliente</Text>
        <View style={estilos.buscador}>
          <TextInput
            accessibilityLabel="Buscar cliente"
            editable={!cargandoClientes}
            onChangeText={texto => {
              establecerBusqueda(texto);
              if (cliente && texto !== cliente.nombre) {
                establecerCliente(null);
                establecerVehiculos([]);
                establecerVehiculo(null);
              }
            }}
            placeholder="Buscar por nombre, correo o teléfono"
            placeholderTextColor="#77777F"
            style={estilos.entradaBuscador}
            value={busqueda}
          />
          {cargandoClientes ? <ActivityIndicator color="#13C296" size="small" /> : null}
        </View>

        {cliente ? (
          <View style={estilos.clienteSeleccionado}>
            <View style={estilos.avatarCliente}>
              <Text style={estilos.inicialCliente}>{cliente.nombre.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={estilos.datosCliente}>
              <Text style={estilos.nombreCliente}>{cliente.nombre}</Text>
              <Text style={estilos.contactoCliente}>
                {cliente.telefono || cliente.correo || 'Cliente registrado'}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={limpiarCliente}>
              <Text style={estilos.cambiarCliente}>Cambiar</Text>
            </Pressable>
          </View>
        ) : null}

        {coincidencias.length > 0 ? (
          <View style={estilos.resultados}>
            {coincidencias.map(item => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => seleccionarCliente(item)}
                style={estilos.resultadoCliente}
              >
                <Text style={estilos.nombreResultado}>{item.nombre}</Text>
                <Text style={estilos.contactoResultado}>
                  {item.telefono || item.correo || 'Sin datos de contacto'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!cargandoClientes && busqueda.trim() && !cliente && coincidencias.length === 0 ? (
          <Text style={estilos.sinResultados}>No encontramos un cliente con esos datos.</Text>
        ) : null}

        {cliente ? (
          <View style={estilos.tarjetaVehiculo}>
            <Text style={estilos.tituloTarjeta}>Vehículo</Text>
            {cargandoVehiculos ? (
              <ActivityIndicator color="#13C296" />
            ) : vehiculos.length === 0 ? (
              <Text style={estilos.sinResultados}>Este cliente todavía no tiene vehículos registrados.</Text>
            ) : (
              <View style={estilos.listaVehiculos}>
                {vehiculos.map(item => {
                  const activo = vehiculo?.id === item.id;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: activo }}
                      key={item.id}
                      onPress={() => establecerVehiculo(item)}
                      style={[estilos.vehiculo, activo && estilos.vehiculoActivo]}
                    >
                      <View style={estilos.datosVehiculo}>
                        <Text style={estilos.nombreVehiculo}>
                          {[item.marca, item.modelo, item.anio].filter(Boolean).join(' ')}
                        </Text>
                        <Text style={estilos.patenteVehiculo}>{item.patente || 'Sin patente'}</Text>
                      </View>
                      <View style={[estilos.radio, activo && estilos.radioActivo]} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        <Text style={estilos.etiqueta}>Motivo de ingreso</Text>
        <TextInput
          accessibilityLabel="Motivo de ingreso"
          multiline
          onChangeText={establecerMotivo}
          placeholder="Describe la consulta, la falla informada o el mantenimiento solicitado"
          placeholderTextColor="#77777F"
          style={estilos.areaTexto}
          textAlignVertical="top"
          value={motivo}
        />

        {error ? <Text accessibilityRole="alert" style={estilos.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={cargandoVehiculos}
          onPress={continuar}
          style={({ pressed }) => [
            estilos.boton,
            pressed && estilos.presionado,
            cargandoVehiculos && estilos.deshabilitado,
          ]}
        >
          <Text style={estilos.textoBoton}>Continuar y asignar mecánico</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Cabecera({ alVolver }: { alVolver: () => void }) {
  return (
    <View style={estilos.cabecera}>
      <Pressable accessibilityLabel="Volver" accessibilityRole="button" onPress={alVolver} style={estilos.volver}>
        <Text style={estilos.flechaVolver}>‹</Text>
      </Pressable>
      <View>
        <Text style={estilos.seccion}>Recepción</Text>
        <Text style={estilos.titulo}>Nueva orden de trabajo</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  volver: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#171719', borderWidth: 1, borderColor: '#2C2C30' },
  flechaVolver: { color: '#E8E8EA', fontSize: 30, lineHeight: 31 },
  seccion: { color: '#13C296', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  titulo: { color: '#F4F4F5', fontSize: 23, fontWeight: '700' },
  etiqueta: { color: '#929299', fontSize: 11, fontWeight: '700', marginBottom: 8 },
  buscador: { minHeight: 50, flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181A', borderWidth: 1, borderColor: '#2D2D31', borderRadius: 12, paddingHorizontal: 13 },
  entradaBuscador: { flex: 1, color: '#F4F4F5', fontSize: 14, paddingVertical: 0 },
  clienteSeleccionado: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10251F', borderWidth: 1, borderColor: '#176B56', borderRadius: 13, padding: 12, marginTop: 9 },
  avatarCliente: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#13C296' },
  inicialCliente: { color: '#052018', fontWeight: '800' },
  datosCliente: { flex: 1, marginHorizontal: 11 },
  nombreCliente: { color: '#F4F4F5', fontSize: 14, fontWeight: '700' },
  contactoCliente: { color: '#94A39E', fontSize: 11, marginTop: 3 },
  cambiarCliente: { color: '#4DDBB7', fontSize: 11, fontWeight: '700' },
  resultados: { backgroundColor: '#18181A', borderWidth: 1, borderColor: '#2D2D31', borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  resultadoCliente: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#303034' },
  nombreResultado: { color: '#ECECEE', fontSize: 13, fontWeight: '600' },
  contactoResultado: { color: '#85858C', fontSize: 11, marginTop: 3 },
  sinResultados: { color: '#898990', fontSize: 12, marginTop: 8 },
  tarjetaVehiculo: { backgroundColor: '#171719', borderWidth: 1, borderColor: '#2D2D31', borderRadius: 17, padding: 14, marginTop: 18 },
  tituloTarjeta: { color: '#13C296', fontSize: 12, fontWeight: '700', marginBottom: 13 },
  listaVehiculos: { gap: 9 },
  vehiculo: { minHeight: 62, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1B1B1E', borderWidth: 1, borderColor: '#303034', borderRadius: 12, padding: 12 },
  vehiculoActivo: { backgroundColor: '#10251F', borderColor: '#13C296' },
  datosVehiculo: { flex: 1 },
  nombreVehiculo: { color: '#F0F0F2', fontSize: 13, fontWeight: '700' },
  patenteVehiculo: { color: '#8F8F97', fontSize: 11, marginTop: 4 },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: '#45454B' },
  radioActivo: { borderWidth: 5, borderColor: '#13C296', backgroundColor: '#CFFFF2' },
  areaTexto: { minHeight: 92, color: '#F4F4F5', backgroundColor: '#18181A', borderWidth: 1, borderColor: '#2D2D31', borderRadius: 12, padding: 13, fontSize: 13, lineHeight: 18 },
  error: { color: '#FF9C94', fontSize: 12, lineHeight: 18, marginTop: 13 },
  boton: { minHeight: 52, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#13C296', borderRadius: 13, marginTop: 24 },
  textoBoton: { color: '#061B15', fontSize: 14, fontWeight: '800' },
  presionado: { opacity: 0.78 },
  deshabilitado: { opacity: 0.55 },
});

export default NuevaOrdenTrabajo;
