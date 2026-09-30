import React, { useState } from 'react';
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
import { crearCliente } from '../clientes/ServicioClientes';
import type { SesionTaller } from '../tipos/usuarioTaller';
import { crearVehiculo } from '../vehiculos/ServicioVehiculos';

interface Propiedades {
  sesion: SesionTaller;
  alVolver: () => void;
}

export function RegistrarClienteVehiculo({ sesion, alVolver }: Propiedades) {
  const [nombre, establecerNombre] = useState('');
  const [telefono, establecerTelefono] = useState('');
  const [correo, establecerCorreo] = useState('');
  const [patente, establecerPatente] = useState('');
  const [marca, establecerMarca] = useState('');
  const [modelo, establecerModelo] = useState('');
  const [anio, establecerAnio] = useState('');
  const [vin, establecerVin] = useState('');
  const [guardando, establecerGuardando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const [exito, establecerExito] = useState<string | null>(null);

  async function registrar() {
    if (nombre.trim().length < 2) {
      establecerError('Ingresa el nombre del cliente.');
      return;
    }
    if (!telefono.trim()) {
      establecerError('Ingresa un teléfono de contacto.');
      return;
    }
    if (!patente.trim() || !marca.trim() || !modelo.trim()) {
      establecerError('Completa la patente, marca y modelo del vehículo.');
      return;
    }
    const anioNumero = Number(anio);
    if (!Number.isInteger(anioNumero) || anioNumero < 1886) {
      establecerError('Ingresa un año válido.');
      return;
    }

    establecerError(null);
    establecerExito(null);
    establecerGuardando(true);
    try {
      const cliente = await crearCliente(
        { nombre, telefono, correo: correo || null },
        sesion,
      );
      await crearVehiculo(
        {
          clienteId: cliente.id,
          patente,
          marca,
          modelo,
          anio: anioNumero,
          vin: vin || null,
        },
        sesion,
      );
      establecerExito(`${cliente.nombre} y su vehículo quedaron registrados.`);
      establecerNombre('');
      establecerTelefono('');
      establecerCorreo('');
      establecerPatente('');
      establecerMarca('');
      establecerModelo('');
      establecerAnio('');
      establecerVin('');
    } catch (capturado) {
      establecerError(
        capturado instanceof Error
          ? capturado.message
          : 'No se pudo completar el registro.',
      );
    } finally {
      establecerGuardando(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Cabecera alVolver={alVolver} />

        <View style={estilos.tarjeta}>
          <Text style={estilos.tituloSeccion}>Datos del cliente</Text>
          <Campo etiqueta="Nombre" valor={nombre} alCambiar={establecerNombre} placeholder="Nombre completo" />
          <Campo etiqueta="Teléfono" valor={telefono} alCambiar={establecerTelefono} placeholder="Ej. +56 9 1234 5678" teclado="phone-pad" />
          <Campo etiqueta="Correo (opcional)" valor={correo} alCambiar={establecerCorreo} placeholder="cliente@correo.cl" teclado="email-address" />
        </View>

        <View style={estilos.tarjeta}>
          <Text style={estilos.tituloSeccion}>Datos del vehículo</Text>
          <View style={estilos.fila}>
            <Campo etiqueta="Patente" valor={patente} alCambiar={establecerPatente} placeholder="AB12CD" mitad mayusculas />
            <Campo etiqueta="Año" valor={anio} alCambiar={establecerAnio} placeholder="2021" teclado="number-pad" mitad />
          </View>
          <View style={estilos.fila}>
            <Campo etiqueta="Marca" valor={marca} alCambiar={establecerMarca} placeholder="Toyota" mitad />
            <Campo etiqueta="Modelo" valor={modelo} alCambiar={establecerModelo} placeholder="Hilux" mitad />
          </View>
          <Campo etiqueta="VIN (opcional)" valor={vin} alCambiar={establecerVin} placeholder="17 caracteres" mayusculas />
        </View>

        {error ? <Text accessibilityRole="alert" style={estilos.error}>{error}</Text> : null}
        {exito ? <Text accessibilityRole="alert" style={estilos.exito}>{exito}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={guardando}
          onPress={registrar}
          style={({ pressed }) => [estilos.boton, pressed && estilos.presionado, guardando && estilos.deshabilitado]}
        >
          {guardando ? <ActivityIndicator color="#061B15" size="small" /> : null}
          <Text style={estilos.textoBoton}>{guardando ? 'Guardando...' : 'Registrar cliente y vehículo'}</Text>
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
      <View style={estilos.textosCabecera}>
        <Text style={estilos.seccion}>Recepción</Text>
        <Text style={estilos.titulo}>Registrar cliente y vehículo</Text>
      </View>
    </View>
  );
}

function Campo({ etiqueta, valor, alCambiar, placeholder, teclado, mitad, mayusculas }: {
  etiqueta: string;
  valor: string;
  alCambiar: (texto: string) => void;
  placeholder: string;
  teclado?: 'phone-pad' | 'email-address' | 'number-pad';
  mitad?: boolean;
  mayusculas?: boolean;
}) {
  return (
    <View style={mitad ? estilos.campoMitad : estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        autoCapitalize={mayusculas ? 'characters' : teclado === 'email-address' ? 'none' : 'words'}
        keyboardType={teclado}
        onChangeText={alCambiar}
        placeholder={placeholder}
        placeholderTextColor="#77777F"
        style={estilos.entrada}
        value={valor}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 23 },
  volver: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#171719', borderWidth: 1, borderColor: '#2C2C30' },
  flechaVolver: { color: '#E8E8EA', fontSize: 30, lineHeight: 31 },
  textosCabecera: { flex: 1 },
  seccion: { color: '#13C296', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  titulo: { color: '#F4F4F5', fontSize: 22, fontWeight: '700' },
  tarjeta: { backgroundColor: '#171719', borderWidth: 1, borderColor: '#2D2D31', borderRadius: 17, padding: 15, marginBottom: 14 },
  tituloSeccion: { color: '#13C296', fontSize: 12, fontWeight: '700', marginBottom: 15 },
  fila: { flexDirection: 'row', gap: 10 },
  campo: { marginBottom: 14 },
  campoMitad: { flex: 1, marginBottom: 14 },
  etiqueta: { color: '#96969D', fontSize: 10, fontWeight: '700', marginBottom: 7 },
  entrada: { minHeight: 48, color: '#F4F4F5', backgroundColor: '#111113', borderWidth: 1, borderColor: '#303034', borderRadius: 11, paddingHorizontal: 12, fontSize: 13 },
  error: { color: '#FF9C94', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  exito: { color: '#75E4C5', backgroundColor: '#10251F', borderRadius: 11, padding: 12, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  boton: { minHeight: 52, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#13C296', borderRadius: 13 },
  textoBoton: { color: '#061B15', fontSize: 14, fontWeight: '800' },
  presionado: { opacity: 0.78 },
  deshabilitado: { opacity: 0.55 },
});

export default RegistrarClienteVehiculo;
