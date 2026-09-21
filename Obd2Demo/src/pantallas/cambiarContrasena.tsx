import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  alCambiar: (nuevaContrasena: string) => Promise<SesionTaller>;
  alCerrarSesion: () => Promise<void>;
}

export function CambiarContrasena({ alCambiar, alCerrarSesion }: Propiedades) {
  const [nueva, establecerNueva] = useState('');
  const [confirmacion, establecerConfirmacion] = useState('');
  const [error, establecerError] = useState<string | null>(null);
  const [enviando, establecerEnviando] = useState(false);

  async function guardar() {
    if (nueva.length < 8) {
      establecerError('La nueva contrasena debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== confirmacion) {
      establecerError('Las contrasenas no coinciden.');
      return;
    }
    establecerError(null);
    establecerEnviando(true);
    try {
      await alCambiar(nueva);
      establecerNueva('');
      establecerConfirmacion('');
    } catch (capturado) {
      establecerError(capturado instanceof Error
        ? capturado.message : 'No fue posible cambiar la contrasena.');
    } finally {
      establecerEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.pantalla}
    >
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={estilos.marca}>SmartOBD · TALLER</Text>
        <Text style={estilos.titulo}>Crea tu nueva contrasena</Text>
        <Text style={estilos.descripcion}>
          Tu cuenta fue creada por el taller con una contrasena temporal.
          Para continuar, reemplazala por una que solo tu conozcas.
        </Text>
        <View style={estilos.formulario}>
          <Text style={estilos.etiqueta}>Nueva contrasena</Text>
          <TextInput
            accessibilityLabel="Nueva contrasena"
            autoCapitalize="none"
            autoComplete="new-password"
            onChangeText={establecerNueva}
            placeholder="Minimo 8 caracteres"
            placeholderTextColor="#68686F"
            secureTextEntry
            style={estilos.entrada}
            value={nueva}
          />
          <Text style={estilos.etiqueta}>Confirmar contrasena</Text>
          <TextInput
            accessibilityLabel="Confirmar contrasena"
            autoCapitalize="none"
            autoComplete="new-password"
            onChangeText={establecerConfirmacion}
            placeholder="Repite la nueva contrasena"
            placeholderTextColor="#68686F"
            secureTextEntry
            style={estilos.entrada}
            value={confirmacion}
          />
          {error ? <Text accessibilityRole="alert" style={estilos.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={enviando}
            onPress={guardar}
            style={[estilos.boton, enviando && estilos.deshabilitado]}
          >
            <Text style={estilos.textoBoton}>
              {enviando ? 'Actualizando...' : 'Cambiar contrasena'}
            </Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={alCerrarSesion} style={estilos.salir}>
          <Text style={estilos.textoSalir}>Cerrar sesion</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 30 },
  marca: { color: '#10A37F', fontWeight: '800', letterSpacing: 1.2, fontSize: 12 },
  titulo: { color: '#F4F4F5', fontWeight: '700', fontSize: 29, marginTop: 24 },
  descripcion: { color: '#A1A1AA', fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 24 },
  formulario: { backgroundColor: '#171719', borderWidth: 1, borderColor: '#303034', borderRadius: 18, padding: 18 },
  etiqueta: { color: '#D4D4D8', fontWeight: '600', marginBottom: 8 },
  entrada: { minHeight: 50, color: '#F4F4F5', backgroundColor: '#101011', borderWidth: 1, borderColor: '#38383D', borderRadius: 12, paddingHorizontal: 14, marginBottom: 18 },
  error: { color: '#FF9C94', fontSize: 12, marginBottom: 14 },
  boton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10A37F', borderRadius: 12 },
  deshabilitado: { opacity: 0.55 },
  textoBoton: { color: '#FFFFFF', fontWeight: '800' },
  salir: { alignItems: 'center', paddingTop: 20 },
  textoSalir: { color: '#A1A1AA', fontWeight: '600' },
});

export default CambiarContrasena;
