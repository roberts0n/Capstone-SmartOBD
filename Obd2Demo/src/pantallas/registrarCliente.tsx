import React, { useEffect, useRef, useState } from 'react';
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
import {
  crearCliente,
  normalizarTelefonoChileno,
  prepararTelefonoParaEntrada,
} from '../clientes/ServicioClientes';
import type { ClienteTaller } from '../clientes/TiposCliente';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alAgregarVehiculo: (clienteId: string) => void;
  alFinalizar: () => void;
  alVolver: () => void;
  alClienteRegistrado?: (cliente: ClienteTaller) => void;
  etiquetaFinalizar?: string;
}

export function RegistrarCliente({
  sesion,
  alAgregarVehiculo,
  alFinalizar,
  alVolver,
  alClienteRegistrado,
  etiquetaFinalizar = 'Finalizar',
}: Propiedades) {
  const [nombre, establecerNombre] = useState('');
  const [telefono, establecerTelefono] = useState('');
  const [correo, establecerCorreo] = useState('');
  const [guardando, establecerGuardando] = useState(false);
  const [clienteCreado, establecerClienteCreado] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const [error, establecerError] = useState<string | null>(null);
  const operacionEnCurso = useRef(false);
  const pantallaActiva = useRef(true);

  useEffect(() => {
    pantallaActiva.current = true;
    return () => {
      pantallaActiva.current = false;
    };
  }, []);

  async function registrar() {
    if (operacionEnCurso.current || clienteCreado) return;
    if (nombre.trim().length < 2) {
      establecerError('Ingresa el nombre del cliente.');
      return;
    }
    let telefonoNormalizado: string;
    try {
      telefonoNormalizado = normalizarTelefonoChileno(telefono);
    } catch (capturado) {
      establecerError((capturado as Error).message);
      return;
    }

    establecerError(null);
    operacionEnCurso.current = true;
    establecerGuardando(true);
    try {
      const cliente = await crearCliente(
        { nombre, telefono: telefonoNormalizado, correo: correo || null },
        sesion,
      );
      if (!pantallaActiva.current) return;
      establecerClienteCreado({ id: cliente.id, nombre: cliente.nombre });
      // aviso que ya existe, aunque despues se cancele el registro del auto
      alClienteRegistrado?.(cliente);
    } catch (capturado) {
      if (pantallaActiva.current)
        establecerError(
          capturado instanceof Error
            ? capturado.message
            : 'No se pudo registrar el cliente.',
        );
    } finally {
      operacionEnCurso.current = false;
      if (pantallaActiva.current) establecerGuardando(false);
    }
  }

  if (clienteCreado) {
    return (
      <View style={estilos.pantalla}>
        <View style={estilos.contenidoConfirmacion}>
          <Cabecera alVolver={alFinalizar} />
          <View style={estilos.confirmacion}>
            <Text style={estilos.tituloConfirmacion}>Cliente registrado</Text>
            <Text style={estilos.nombreConfirmacion}>
              {clienteCreado.nombre}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => alAgregarVehiculo(clienteCreado.id)}
            style={({ pressed }) => [
              estilos.boton,
              pressed && estilos.presionado,
            ]}
          >
            <Text style={estilos.textoBoton}>Agregar vehículo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={alFinalizar}
            style={({ pressed }) => [
              estilos.botonSecundario,
              pressed && estilos.presionado,
            ]}
          >
            <Text style={estilos.textoBotonSecundario}>
              {etiquetaFinalizar}
            </Text>
          </Pressable>
        </View>
      </View>
    );
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
        <Campo
          etiqueta="Nombre"
          valor={nombre}
          alCambiar={establecerNombre}
          placeholder="Nombre completo"
        />
        <Campo
          etiqueta="Teléfono"
          valor={telefono}
          alCambiar={texto =>
            establecerTelefono(prepararTelefonoParaEntrada(texto))
          }
          placeholder="9 1234 5678"
          teclado="phone-pad"
          prefijo="+56"
        />
        <Campo
          etiqueta="Correo (opcional)"
          valor={correo}
          alCambiar={establecerCorreo}
          placeholder="cliente@correo.cl"
          teclado="email-address"
        />

        {error ? (
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={guardando}
          onPress={registrar}
          style={({ pressed }) => [
            estilos.boton,
            pressed && estilos.presionado,
            guardando && estilos.deshabilitado,
          ]}
        >
          {guardando ? (
            <ActivityIndicator color="#061B15" size="small" />
          ) : null}
          <Text style={estilos.textoBoton}>
            {guardando ? 'Guardando...' : 'Registrar cliente'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Cabecera({ alVolver }: { alVolver: () => void }) {
  return (
    <View style={estilos.cabecera}>
      <Pressable
        accessibilityLabel="Volver"
        accessibilityRole="button"
        onPress={alVolver}
        style={estilos.volver}
      >
        <Text style={estilos.flechaVolver}>‹</Text>
      </Pressable>
      <Text style={estilos.titulo}>Registrar cliente</Text>
    </View>
  );
}

function Campo({
  etiqueta,
  valor,
  alCambiar,
  placeholder,
  teclado,
  prefijo,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (texto: string) => void;
  placeholder: string;
  teclado?: 'phone-pad' | 'email-address';
  prefijo?: string;
}) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View style={prefijo ? estilos.entradaConPrefijo : undefined}>
        {prefijo ? <Text style={estilos.prefijo}>{prefijo}</Text> : null}
        <TextInput
          accessibilityLabel={etiqueta}
          autoCapitalize={teclado === 'email-address' ? 'none' : 'words'}
          keyboardType={teclado}
          onChangeText={alCambiar}
          placeholder={placeholder}
          placeholderTextColor="#77777F"
          style={prefijo ? estilos.entradaTelefono : estilos.entrada}
          value={valor}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  contenidoConfirmacion: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
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
  titulo: { color: '#F4F4F5', fontSize: 22, fontWeight: '700' },
  campo: { marginBottom: 16 },
  etiqueta: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 7,
  },
  entrada: {
    minHeight: 50,
    color: '#F4F4F5',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  entradaConPrefijo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 12,
    paddingLeft: 13,
  },
  prefijo: { color: '#A1A1AA', fontSize: 14 },
  entradaTelefono: {
    flex: 1,
    minHeight: 50,
    color: '#F4F4F5',
    paddingHorizontal: 13,
    fontSize: 14,
  },
  error: { color: '#FF9C94', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  boton: {
    minHeight: 52,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13C296',
    borderRadius: 13,
    marginTop: 5,
  },
  textoBoton: { color: '#061B15', fontSize: 14, fontWeight: '800' },
  botonSecundario: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 13,
    marginTop: 12,
  },
  textoBotonSecundario: { color: '#E4E4E7', fontSize: 14, fontWeight: '700' },
  confirmacion: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 18,
    marginBottom: 20,
  },
  tituloConfirmacion: { color: '#75E4C5', fontSize: 14, fontWeight: '700' },
  nombreConfirmacion: { color: '#F4F4F5', fontSize: 18, marginTop: 8 },
  presionado: { opacity: 0.78 },
  deshabilitado: { opacity: 0.55 },
});

export default RegistrarCliente;
