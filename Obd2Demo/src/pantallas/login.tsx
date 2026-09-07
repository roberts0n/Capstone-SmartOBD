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

interface PropiedadesLogin {
  alIngresar: (correo: string) => void;
  alContinuarComoInvitado?: () => void;
}

/** Pantalla de acceso visual. La autenticacion real se conecta en alIngresar. */
export function Login({
  alIngresar,
  alContinuarComoInvitado,
}: PropiedadesLogin) {
  const [correo, establecerCorreo] = useState('');
  const [contrasena, establecerContrasena] = useState('');
  const [mostrarContrasena, establecerMostrarContrasena] = useState(false);
  const [error, establecerError] = useState<string | null>(null);

  function ingresar() {
    const correoLimpio = correo.trim();

    if (!correoLimpio || !correoLimpio.includes('@')) {
      establecerError('Ingresa un correo electronico valido.');
      return;
    }
    if (contrasena.length < 6) {
      establecerError('La contrasena debe tener al menos 6 caracteres.');
      return;
    }

    establecerError(null);
    alIngresar(correoLimpio);
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
          <View style={estilos.logo}>
            <View style={estilos.logoCentro} />
            <View style={[estilos.conector, estilos.conectorIzquierdo]} />
            <View style={[estilos.conector, estilos.conectorDerecho]} />
          </View>
          <Text style={estilos.nombreMarca}>SmartOBD</Text>
        </View>

        <View style={estilos.introduccion}>
          <Text style={estilos.sobretitulo}>DIAGNOSTICO INTELIGENTE</Text>
          <Text style={estilos.titulo}>Tu vehiculo, explicado con claridad.</Text>
          <Text style={estilos.descripcion}>
            Conecta tu escaner OBD-II, interpreta alertas y revisa el estado del
            motor desde un solo lugar.
          </Text>
        </View>

        <View style={estilos.formulario}>
          <Text style={estilos.tituloFormulario}>Iniciar sesion</Text>
          <Text style={estilos.subtituloFormulario}>
            Accede a tus vehiculos y diagnosticos guardados.
          </Text>

          <Text style={estilos.etiqueta}>Correo electronico</Text>
          <TextInput
            accessibilityLabel="Correo electronico"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={establecerCorreo}
            placeholder="nombre@correo.com"
            placeholderTextColor="#6B6B70"
            style={estilos.entrada}
            value={correo}
          />

          <Text style={estilos.etiqueta}>Contrasena</Text>
          <View style={estilos.filaContrasena}>
            <TextInput
              accessibilityLabel="Contrasena"
              autoCapitalize="none"
              autoComplete="password"
              onChangeText={establecerContrasena}
              onSubmitEditing={ingresar}
              placeholder="Minimo 6 caracteres"
              placeholderTextColor="#6B6B70"
              secureTextEntry={!mostrarContrasena}
              style={estilos.entradaContrasena}
              value={contrasena}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => establecerMostrarContrasena(valor => !valor)}
              hitSlop={8}
            >
              <Text style={estilos.mostrar}>
                {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
              </Text>
            </Pressable>
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={estilos.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={ingresar}
            style={({ pressed }) => [
              estilos.botonPrincipal,
              pressed && estilos.presionado,
            ]}
          >
            <Text style={estilos.textoBotonPrincipal}>Continuar</Text>
            <Text style={estilos.flecha}>→</Text>
          </Pressable>

          {alContinuarComoInvitado ? (
            <Pressable
              accessibilityRole="button"
              onPress={alContinuarComoInvitado}
              style={({ pressed }) => [
                estilos.botonSecundario,
                pressed && estilos.presionado,
              ]}
            >
              <Text style={estilos.textoBotonSecundario}>
                Continuar como invitado
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={estilos.notaSeguridad}>
          <View style={estilos.puntoSeguro} />
          <Text style={estilos.textoSeguridad}>
            Tus datos de diagnostico permanecen privados en este dispositivo.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const COLORES = {
  fondo: '#0D0D0E',
  superficie: '#171719',
  borde: '#303034',
  texto: '#F4F4F5',
  secundario: '#A1A1AA',
  verde: '#10A37F',
  verdeOscuro: '#0D765D',
  azul: '#58A6FF',
};

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3E',
    backgroundColor: '#202023',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCentro: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: COLORES.verde,
    borderRadius: 4,
  },
  conector: {
    position: 'absolute',
    width: 5,
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORES.azul,
  },
  conectorIzquierdo: { left: 6 },
  conectorDerecho: { right: 6 },
  nombreMarca: { color: COLORES.texto, fontWeight: '700', fontSize: 18 },
  introduccion: { marginTop: 46, marginBottom: 30 },
  sobretitulo: {
    color: COLORES.verde,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  titulo: {
    color: COLORES.texto,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  descripcion: {
    color: COLORES.secundario,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 14,
  },
  formulario: {
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 20,
    padding: 20,
  },
  tituloFormulario: { color: COLORES.texto, fontSize: 20, fontWeight: '700' },
  subtituloFormulario: {
    color: COLORES.secundario,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 22,
  },
  etiqueta: {
    color: '#D4D4D8',
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 8,
  },
  entrada: {
    height: 50,
    color: COLORES.texto,
    backgroundColor: '#101011',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 18,
  },
  filaContrasena: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101011',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    paddingRight: 14,
  },
  entradaContrasena: {
    flex: 1,
    color: COLORES.texto,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  mostrar: { color: COLORES.verde, fontSize: 13, fontWeight: '700' },
  error: { color: '#FF8A80', fontSize: 13, lineHeight: 18, marginTop: 10 },
  botonPrincipal: {
    height: 52,
    backgroundColor: COLORES.verde,
    borderRadius: 12,
    marginTop: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textoBotonPrincipal: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  flecha: { color: '#FFFFFF', fontSize: 22 },
  botonSecundario: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonSecundario: { color: '#D4D4D8', fontWeight: '600' },
  presionado: { opacity: 0.75 },
  notaSeguridad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 14,
  },
  puntoSeguro: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORES.verdeOscuro,
    marginTop: 6,
  },
  textoSeguridad: {
    flex: 1,
    color: '#77777E',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default Login;
