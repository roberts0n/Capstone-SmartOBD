import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface PropiedadesActivarCuenta {
  sesionPreparada?: boolean;
  alValidarCodigo: (correo: string, codigo: string) => Promise<void>;
  alActivar: (contrasena: string) => Promise<SesionTaller>;
}

export function ActivarCuenta({
  sesionPreparada = false,
  alValidarCodigo,
  alActivar,
}: PropiedadesActivarCuenta) {
  const [correo, establecerCorreo] = useState('');
  const [codigo, establecerCodigo] = useState('');
  const [codigoValidado, establecerCodigoValidado] = useState(sesionPreparada);
  const [contrasena, establecerContrasena] = useState('');
  const [confirmacion, establecerConfirmacion] = useState('');
  const [mostrar, establecerMostrar] = useState(false);
  const [guardando, establecerGuardando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);

  async function validarCodigo() {
    establecerError(null);
    establecerGuardando(true);
    try {
      await alValidarCodigo(correo, codigo);
      establecerCodigoValidado(true);
    } catch (capturado) {
      establecerError(
        capturado instanceof Error
          ? capturado.message
          : 'No se pudo validar el codigo.',
      );
    } finally {
      establecerGuardando(false);
    }
  }

  async function guardar() {
    if (contrasena.length < 8) {
      establecerError('La contrasena debe tener al menos 8 caracteres.');
      return;
    }
    if (!/[A-Za-z]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
      establecerError('Combina letras y numeros en tu contrasena.');
      return;
    }
    if (contrasena !== confirmacion) {
      establecerError('Las contrasenas no coinciden.');
      return;
    }

    establecerError(null);
    establecerGuardando(true);
    try {
      await alActivar(contrasena);
    } catch (capturado) {
      establecerError(
        capturado instanceof Error
          ? capturado.message
          : 'No se pudo activar la cuenta.',
      );
    } finally {
      establecerGuardando(false);
    }
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
        <View style={estilos.marca}>
          <View style={estilos.iconoMarca}>
            <Text style={estilos.textoIcono}>S</Text>
          </View>
          <Text style={estilos.nombreMarca}>SmartOBD</Text>
        </View>

        <Text style={estilos.sobretitulo}>INVITACION DEL TALLER</Text>
        <Text style={estilos.titulo}>Activa tu cuenta</Text>
        <Text style={estilos.descripcion}>
          {codigoValidado
            ? 'Crea una contraseña personal. Administración no podrá verla.'
            : 'Ingresa el correo invitado y el código recibido. El código solo se puede utilizar una vez.'}
        </Text>

        <View style={estilos.tarjeta}>
          {!codigoValidado ? (
            <>
              <Text style={estilos.etiqueta}>Correo invitado</Text>
              <TextInput
                accessibilityLabel="Correo invitado"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={establecerCorreo}
                placeholder="nombre@taller.cl"
                placeholderTextColor="#68686F"
                style={estilos.entrada}
                value={correo}
              />
              <Text style={estilos.etiqueta}>Código de invitación</Text>
              <TextInput
                accessibilityLabel="Codigo de invitacion"
                keyboardType="number-pad"
                maxLength={10}
                onChangeText={establecerCodigo}
                placeholder="12345678"
                placeholderTextColor="#68686F"
                style={[estilos.entrada, estilos.codigo]}
                value={codigo}
              />
            </>
          ) : (
            <>
              <CampoContrasena
                etiqueta="Nueva contraseña"
                valor={contrasena}
                alCambiar={establecerContrasena}
                mostrar={mostrar}
              />
              <CampoContrasena
                etiqueta="Confirmar contraseña"
                valor={confirmacion}
                alCambiar={establecerConfirmacion}
                mostrar={mostrar}
              />

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: mostrar }}
                onPress={() => establecerMostrar(valor => !valor)}
                style={estilos.mostrar}
              >
                <View
                  style={[estilos.casilla, mostrar && estilos.casillaActiva]}
                >
                  {mostrar ? <Text style={estilos.check}>✓</Text> : null}
                </View>
                <Text style={estilos.textoMostrar}>Mostrar contraseña</Text>
              </Pressable>

              <Text style={estilos.ayuda}>
                Usa 8 caracteres como mínimo y combina letras con números.
              </Text>
            </>
          )}

          {error ? (
            <Text accessibilityRole="alert" style={estilos.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={guardando}
            onPress={codigoValidado ? guardar : validarCodigo}
            style={({ pressed }) => [
              estilos.boton,
              pressed && estilos.presionado,
              guardando && estilos.deshabilitado,
            ]}
          >
            <Text style={estilos.textoBoton}>
              {guardando
                ? 'Verificando...'
                : codigoValidado
                ? 'Guardar y continuar'
                : 'Validar código'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CampoContrasena({
  etiqueta,
  valor,
  alCambiar,
  mostrar,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  mostrar: boolean;
}) {
  return (
    <View style={estilos.grupoCampo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        autoCapitalize="none"
        autoComplete="new-password"
        onChangeText={alCambiar}
        placeholder="••••••••"
        placeholderTextColor="#68686F"
        secureTextEntry={!mostrar}
        style={estilos.entrada}
        value={valor}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 36,
  },
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 36,
  },
  iconoMarca: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10A37F',
  },
  textoIcono: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  nombreMarca: { color: '#F4F4F5', fontSize: 18, fontWeight: '700' },
  sobretitulo: {
    color: '#10A37F',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  titulo: { color: '#F4F4F5', fontSize: 31, fontWeight: '700', marginTop: 8 },
  descripcion: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  tarjeta: {
    marginTop: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 18,
    backgroundColor: '#171719',
  },
  grupoCampo: { marginBottom: 17 },
  etiqueta: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  entrada: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#38383D',
    borderRadius: 12,
    color: '#F4F4F5',
    backgroundColor: '#101011',
    fontSize: 15,
    marginBottom: 17,
  },
  codigo: { fontSize: 20, fontWeight: '700', letterSpacing: 4 },
  mostrar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    alignSelf: 'flex-start',
  },
  casilla: {
    width: 19,
    height: 19,
    borderWidth: 1,
    borderColor: '#52525B',
    borderRadius: 5,
  },
  casillaActiva: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#10A37F',
    backgroundColor: '#10A37F',
  },
  check: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  textoMostrar: { color: '#C4C4CA', fontSize: 12 },
  ayuda: { color: '#85858C', fontSize: 11, lineHeight: 17, marginTop: 15 },
  error: { color: '#FF9C94', fontSize: 12, lineHeight: 18, marginTop: 14 },
  boton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#10A37F',
  },
  textoBoton: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  presionado: { opacity: 0.82 },
  deshabilitado: { opacity: 0.55 },
});

export default ActivarCuenta;
