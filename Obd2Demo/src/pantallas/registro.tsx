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
import type {
  NuevoPersonal,
  RolPersonalRegistrable,
} from '../servicios/personalTaller';

interface PropiedadesRegistro {
  alRegistrar: (personal: NuevoPersonal) => Promise<string>;
  alVolver: () => void;
}

/** Formulario privado para que Administración cree cuentas del taller. */
export function Registro({ alRegistrar, alVolver }: PropiedadesRegistro) {
  const [nombre, establecerNombre] = useState('');
  const [correo, establecerCorreo] = useState('');
  const [especialidad, establecerEspecialidad] = useState('');
  const [rol, establecerRol] = useState<RolPersonalRegistrable>('recepcion');
  const [contrasenaTemporal, establecerContrasenaTemporal] = useState('');
  const [confirmacion, establecerConfirmacion] = useState('');
  const [enviando, establecerEnviando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const [exito, establecerExito] = useState<string | null>(null);

  async function registrarPersonal() {
    const nombreLimpio = nombre.trim();
    const correoLimpio = correo.trim().toLowerCase();

    if (nombreLimpio.length < 2) {
      establecerError('Ingresa el nombre de la persona.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
      establecerError('Ingresa un correo corporativo valido.');
      return;
    }
    if (rol !== 'recepcion' && rol !== 'mecanico') {
      establecerError('Selecciona un rol permitido.');
      return;
    }
    if (contrasenaTemporal.length < 8) {
      establecerError('La contrasena temporal debe tener al menos 8 caracteres.');
      return;
    }
    if (contrasenaTemporal !== confirmacion) {
      establecerError('Las contrasenas no coinciden.');
      return;
    }

    establecerError(null);
    establecerExito(null);
    establecerEnviando(true);

    try {
      const mensaje = await alRegistrar({
        nombre: nombreLimpio,
        correo: correoLimpio,
        rol,
        especialidad:
          rol === 'mecanico' ? especialidad.trim() || undefined : undefined,
        contrasenaTemporal,
      });
      establecerExito(mensaje);
      establecerNombre('');
      establecerCorreo('');
      establecerEspecialidad('');
      establecerRol('recepcion');
      establecerContrasenaTemporal('');
      establecerConfirmacion('');
    } catch (capturado) {
      establecerError(
        capturado instanceof Error
          ? capturado.message
          : 'No fue posible crear la cuenta.',
      );
    } finally {
      establecerEnviando(false);
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
        <View style={estilos.cabecera}>
          <Pressable
            accessibilityLabel="Volver al inicio"
            accessibilityRole="button"
            onPress={alVolver}
            style={estilos.volver}
          >
            <Text style={estilos.flechaVolver}>‹</Text>
          </Pressable>
          <View style={estilos.titulosCabecera}>
            <Text style={estilos.sobretitulo}>ADMINISTRACION</Text>
            <Text style={estilos.titulo}>Registrar personal</Text>
          </View>
        </View>

        <View style={estilos.aviso}>
          <View style={estilos.puntoSeguro} />
          <Text style={estilos.textoAviso}>
            Entrega el correo corporativo y la contrasena temporal solamente al
            trabajador. En su primer acceso debera cambiarla.
          </Text>
        </View>

        <View style={estilos.formulario}>
          <Campo
            etiqueta="Nombre completo"
            valor={nombre}
            alCambiar={establecerNombre}
            placeholder="Ej. Maria Gonzalez"
            autoComplete="name"
          />
          <Campo
            etiqueta="Correo corporativo"
            valor={correo}
            alCambiar={establecerCorreo}
            placeholder="maria@smartobd.com"
            autoComplete="email"
            teclado="email-address"
          />

          <Text style={estilos.etiqueta}>Rol dentro del taller</Text>
          <View style={estilos.roles}>
            <OpcionRol
              activo={rol === 'recepcion'}
              descripcion="Registra ingresos y casos"
              etiqueta="Recepcion"
              alPresionar={() => establecerRol('recepcion')}
            />
            <OpcionRol
              activo={rol === 'mecanico'}
              descripcion="Diagnostica casos asignados"
              etiqueta="Mecanico"
              alPresionar={() => establecerRol('mecanico')}
            />
          </View>

          {rol === 'mecanico' ? (
            <Campo
              etiqueta="Especialidad (opcional)"
              valor={especialidad}
              alCambiar={establecerEspecialidad}
              placeholder="Ej. Electricidad automotriz"
              autoComplete="off"
            />
          ) : null}

          <Campo
            etiqueta="Contrasena temporal"
            valor={contrasenaTemporal}
            alCambiar={establecerContrasenaTemporal}
            placeholder="Minimo 8 caracteres"
            autoComplete="new-password"
            segura
          />
          <Campo
            etiqueta="Confirmar contrasena temporal"
            valor={confirmacion}
            alCambiar={establecerConfirmacion}
            placeholder="Repite la contrasena"
            autoComplete="new-password"
            segura
          />

          {error ? (
            <Text accessibilityRole="alert" style={estilos.error}>
              {error}
            </Text>
          ) : null}
          {exito ? (
            <View accessibilityRole="alert" style={estilos.cajaExito}>
              <Text style={estilos.tituloExito}>Cuenta creada</Text>
              <Text selectable style={estilos.exito}>
                {exito}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={enviando}
            onPress={registrarPersonal}
            style={({ pressed }) => [
              estilos.boton,
              pressed && estilos.presionado,
              enviando && estilos.deshabilitado,
            ]}
          >
            <Text style={estilos.textoBoton}>
              {enviando ? 'Creando cuenta...' : 'Registrar personal'}
            </Text>
            <Text style={estilos.flecha}>→</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({
  etiqueta,
  valor,
  alCambiar,
  placeholder,
  autoComplete,
  teclado,
  segura,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  placeholder: string;
  autoComplete: 'name' | 'email' | 'off' | 'new-password';
  teclado?: 'email-address';
  segura?: boolean;
}) {
  return (
    <View style={estilos.grupoCampo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        autoCapitalize={teclado || segura ? 'none' : 'words'}
        autoComplete={autoComplete}
        keyboardType={teclado}
        onChangeText={alCambiar}
        placeholder={placeholder}
        placeholderTextColor="#68686F"
        secureTextEntry={segura}
        style={estilos.entrada}
        value={valor}
      />
    </View>
  );
}

function OpcionRol({
  activo,
  etiqueta,
  descripcion,
  alPresionar,
}: {
  activo: boolean;
  etiqueta: string;
  descripcion: string;
  alPresionar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: activo }}
      onPress={alPresionar}
      style={[estilos.rol, activo && estilos.rolActivo]}
    >
      <View style={[estilos.radio, activo && estilos.radioActivo]} />
      <View style={estilos.textoRol}>
        <Text style={[estilos.nombreRol, activo && estilos.nombreRolActivo]}>
          {etiqueta}
        </Text>
        <Text style={estilos.descripcionRol}>{descripcion}</Text>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 40,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  volver: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#303034',
    backgroundColor: '#171719',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flechaVolver: { color: '#F4F4F5', fontSize: 30, lineHeight: 32 },
  titulosCabecera: { flex: 1 },
  sobretitulo: {
    color: '#10A37F',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  titulo: { color: '#F4F4F5', fontSize: 25, fontWeight: '700', marginTop: 3 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#11241F',
    borderWidth: 1,
    borderColor: '#235E4E',
    borderRadius: 14,
    padding: 14,
    marginTop: 24,
  },
  puntoSeguro: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10A37F',
    marginTop: 5,
  },
  textoAviso: { flex: 1, color: '#A7C8BE', fontSize: 12, lineHeight: 18 },
  formulario: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
  },
  grupoCampo: { marginBottom: 17 },
  etiqueta: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  entrada: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#38383D',
    borderRadius: 12,
    backgroundColor: '#101011',
    color: '#F4F4F5',
    fontSize: 14,
    paddingHorizontal: 14,
  },
  roles: { gap: 10, marginBottom: 18 },
  rol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#38383D',
    borderRadius: 12,
    backgroundColor: '#101011',
    paddingHorizontal: 14,
  },
  rolActivo: { borderColor: '#10A37F', backgroundColor: '#11241F' },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#71717A',
  },
  radioActivo: {
    borderWidth: 5,
    borderColor: '#10A37F',
    backgroundColor: '#D9FFF4',
  },
  textoRol: { flex: 1 },
  nombreRol: { color: '#D4D4D8', fontSize: 14, fontWeight: '700' },
  nombreRolActivo: { color: '#B8F3E3' },
  descripcionRol: { color: '#85858C', fontSize: 11, marginTop: 3 },
  error: { color: '#FF9C94', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  cajaExito: {
    backgroundColor: '#11241F',
    borderWidth: 1,
    borderColor: '#235E4E',
    borderRadius: 11,
    padding: 12,
    marginBottom: 12,
  },
  tituloExito: {
    color: '#B8F3E3',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  exito: { color: '#7EE2C5', fontSize: 13, lineHeight: 20 },
  boton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10A37F',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  textoBoton: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  flecha: { color: '#FFFFFF', fontSize: 18 },
  presionado: { opacity: 0.82 },
  deshabilitado: { opacity: 0.55 },
});

export default Registro;
