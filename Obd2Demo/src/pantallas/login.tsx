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
  PerfilTaller,
  SesionTaller,
} from '../tipos/usuarioTaller';

type ModoAcceso = 'ingresar' | 'registro';

interface PropiedadesLogin {
  alIngresar: (sesion: SesionTaller) => void;
}

/** Acceso orientado al personal de un taller automotriz. */
export function Login({ alIngresar }: PropiedadesLogin) {
  const [modo, establecerModo] = useState<ModoAcceso>('ingresar');
  const [perfil, establecerPerfil] = useState<PerfilTaller>('recepcion');
  const [nombre, establecerNombre] = useState('');
  const [taller, establecerTaller] = useState('');
  const [correo, establecerCorreo] = useState('');
  const [contrasena, establecerContrasena] = useState('');
  const [mostrarContrasena, establecerMostrarContrasena] = useState(false);
  const [error, establecerError] = useState<string | null>(null);

  const esRegistro = modo === 'registro';

  function cambiarModo(siguiente: ModoAcceso) {
    establecerModo(siguiente);
    establecerError(null);
  }

  function continuar() {
    const correoLimpio = correo.trim();
    const nombreLimpio = nombre.trim();
    const tallerLimpio = taller.trim();

    if (esRegistro && nombreLimpio.length < 2) {
      establecerError('Escribe el nombre de la persona que usara la cuenta.');
      return;
    }
    if (esRegistro && tallerLimpio.length < 2) {
      establecerError('Escribe el nombre del taller.');
      return;
    }
    if (!correoLimpio || !correoLimpio.includes('@')) {
      establecerError('Ingresa un correo electronico valido.');
      return;
    }
    if (contrasena.length < 6) {
      establecerError('La contrasena debe tener al menos 6 caracteres.');
      return;
    }

    establecerError(null);
    alIngresar({
      nombre: nombreLimpio || nombreDesdeCorreo(correoLimpio),
      correo: correoLimpio,
      taller: tallerLimpio || 'Mi taller',
      perfil,
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
        <View style={estilos.marca}>
          <View style={estilos.logo}>
            <View style={estilos.logoCentro} />
            <View style={[estilos.conector, estilos.conectorIzquierdo]} />
            <View style={[estilos.conector, estilos.conectorDerecho]} />
          </View>
          <View>
            <Text style={estilos.nombreMarca}>SmartOBD</Text>
            <Text style={estilos.edicionMarca}>TALLER</Text>
          </View>
        </View>

        <View style={estilos.introduccion}>
          <Text style={estilos.sobretitulo}>OPERACION Y DIAGNOSTICO</Text>
          <Text style={estilos.titulo}>Cada vehiculo, bajo control.</Text>
          <Text style={estilos.descripcion}>
            Recibe, diagnostica y entrega informacion clara desde una sola
            herramienta para todo el equipo.
          </Text>
        </View>

        <View style={estilos.formulario}>
          <View style={estilos.selectorModo}>
            <OpcionModo
              activa={modo === 'ingresar'}
              etiqueta="Ingresar"
              alPresionar={() => cambiarModo('ingresar')}
            />
            <OpcionModo
              activa={modo === 'registro'}
              etiqueta="Crear cuenta"
              alPresionar={() => cambiarModo('registro')}
            />
          </View>

          <Text style={estilos.tituloFormulario}>
            {esRegistro ? 'Registra tu acceso' : 'Bienvenido al taller'}
          </Text>
          <Text style={estilos.subtituloFormulario}>
            {esRegistro
              ? 'Crea el primer acceso y elige la funcion que tendras en el equipo.'
              : 'Selecciona tu funcion e ingresa con el correo registrado.'}
          </Text>

          <Text style={estilos.etiquetaGrupo}>¿Cual es tu funcion?</Text>
          <View style={estilos.perfiles}>
            <TarjetaPerfil
              activo={perfil === 'recepcion'}
              codigo="RX"
              titulo="Recepcion"
              descripcion="Ingreso y seguimiento"
              alPresionar={() => establecerPerfil('recepcion')}
            />
            <TarjetaPerfil
              activo={perfil === 'mecanico'}
              codigo="MEC"
              titulo="Mecanico"
              descripcion="Revision y diagnostico"
              alPresionar={() => establecerPerfil('mecanico')}
            />
          </View>

          {esRegistro ? (
            <>
              <Campo
                etiqueta="Nombre completo"
                valor={nombre}
                alCambiar={establecerNombre}
                placeholder="Nombre del integrante"
                autoComplete="name"
              />
              <Campo
                etiqueta="Nombre del taller"
                valor={taller}
                alCambiar={establecerTaller}
                placeholder="Ej. Taller Central"
                autoComplete="organization"
              />
            </>
          ) : null}

          <Campo
            etiqueta="Correo electronico"
            valor={correo}
            alCambiar={establecerCorreo}
            placeholder="nombre@taller.cl"
            autoComplete="email"
            teclado="email-address"
          />

          <Text style={estilos.etiqueta}>Contrasena</Text>
          <View style={estilos.filaContrasena}>
            <TextInput
              accessibilityLabel="Contrasena"
              autoCapitalize="none"
              autoComplete={esRegistro ? 'new-password' : 'password'}
              onChangeText={establecerContrasena}
              onSubmitEditing={continuar}
              placeholder="Minimo 6 caracteres"
              placeholderTextColor="#68686F"
              secureTextEntry={!mostrarContrasena}
              style={estilos.entradaContrasena}
              value={contrasena}
            />
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => establecerMostrarContrasena(valor => !valor)}
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
            onPress={continuar}
            style={({ pressed }) => [
              estilos.botonPrincipal,
              pressed && estilos.presionado,
            ]}
          >
            <Text style={estilos.textoBotonPrincipal}>
              {esRegistro ? 'Crear cuenta y continuar' : 'Entrar al taller'}
            </Text>
            <Text style={estilos.flecha}>→</Text>
          </Pressable>
        </View>

        <View style={estilos.notaSeguridad}>
          <View style={estilos.puntoSeguro} />
          <Text style={estilos.textoSeguridad}>
            Acceso privado para personal autorizado. Los datos del cliente y
            del vehiculo permanecen protegidos.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OpcionModo({
  activa,
  etiqueta,
  alPresionar,
}: {
  activa: boolean;
  etiqueta: string;
  alPresionar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: activa }}
      onPress={alPresionar}
      style={[estilos.opcionModo, activa && estilos.opcionModoActiva]}
    >
      <Text style={[estilos.textoModo, activa && estilos.textoModoActivo]}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

function TarjetaPerfil({
  activo,
  codigo,
  titulo,
  descripcion,
  alPresionar,
}: {
  activo: boolean;
  codigo: string;
  titulo: string;
  descripcion: string;
  alPresionar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: activo }}
      onPress={alPresionar}
      style={[estilos.perfil, activo && estilos.perfilActivo]}
    >
      <Text style={[estilos.codigoPerfil, activo && estilos.codigoPerfilActivo]}>
        {codigo}
      </Text>
      <Text style={estilos.tituloPerfil}>{titulo}</Text>
      <Text style={estilos.descripcionPerfil}>{descripcion}</Text>
    </Pressable>
  );
}

function Campo({
  etiqueta,
  valor,
  alCambiar,
  placeholder,
  autoComplete,
  teclado,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  placeholder: string;
  autoComplete: 'name' | 'organization' | 'email';
  teclado?: 'email-address';
}) {
  return (
    <>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        autoCapitalize={teclado ? 'none' : 'words'}
        autoComplete={autoComplete}
        keyboardType={teclado}
        onChangeText={alCambiar}
        placeholder={placeholder}
        placeholderTextColor="#68686F"
        style={estilos.entrada}
        value={valor}
      />
    </>
  );
}

function nombreDesdeCorreo(correo: string): string {
  const base = correo.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Integrante';
}

const COLORES = {
  fondo: '#0D0D0E',
  superficie: '#171719',
  borde: '#303034',
  texto: '#F4F4F5',
  secundario: '#A1A1AA',
  verde: '#10A37F',
  azul: '#58A6FF',
};

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 28,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3E',
    backgroundColor: '#202023',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCentro: {
    width: 13,
    height: 13,
    borderWidth: 2,
    borderColor: COLORES.verde,
    borderRadius: 4,
  },
  conector: {
    position: 'absolute',
    width: 6,
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORES.azul,
  },
  conectorIzquierdo: { left: 6 },
  conectorDerecho: { right: 6 },
  nombreMarca: { color: COLORES.texto, fontWeight: '700', fontSize: 17 },
  edicionMarca: {
    color: COLORES.verde,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  introduccion: { marginTop: 36, marginBottom: 24 },
  sobretitulo: {
    color: COLORES.verde,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  titulo: {
    color: COLORES.texto,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  descripcion: {
    color: COLORES.secundario,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  formulario: {
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 20,
    padding: 18,
  },
  selectorModo: {
    flexDirection: 'row',
    backgroundColor: '#101011',
    borderRadius: 11,
    padding: 3,
    marginBottom: 22,
  },
  opcionModo: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  opcionModoActiva: { backgroundColor: '#29292D' },
  textoModo: { color: '#77777E', fontWeight: '600', fontSize: 13 },
  textoModoActivo: { color: COLORES.texto },
  tituloFormulario: { color: COLORES.texto, fontSize: 20, fontWeight: '700' },
  subtituloFormulario: {
    color: COLORES.secundario,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 20,
  },
  etiquetaGrupo: {
    color: '#D4D4D8',
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 9,
  },
  perfiles: { flexDirection: 'row', gap: 9, marginBottom: 20 },
  perfil: {
    flex: 1,
    minHeight: 98,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 13,
    padding: 11,
  },
  perfilActivo: { borderColor: COLORES.verde, backgroundColor: '#11241F' },
  codigoPerfil: {
    alignSelf: 'flex-start',
    color: '#77777E',
    backgroundColor: '#252529',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 8,
  },
  codigoPerfilActivo: { color: '#75E6C6', backgroundColor: '#1C4439' },
  tituloPerfil: { color: '#EDEDEF', fontWeight: '700', fontSize: 13 },
  descripcionPerfil: { color: '#7F7F87', fontSize: 10, lineHeight: 14, marginTop: 3 },
  etiqueta: {
    color: '#D4D4D8',
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 7,
  },
  entrada: {
    height: 48,
    color: COLORES.texto,
    backgroundColor: '#101011',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 11,
    paddingHorizontal: 13,
    fontSize: 14,
    marginBottom: 16,
  },
  filaContrasena: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101011',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 11,
    paddingRight: 13,
  },
  entradaContrasena: {
    flex: 1,
    color: COLORES.texto,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  mostrar: { color: COLORES.verde, fontSize: 12, fontWeight: '700' },
  error: { color: '#FF8A80', fontSize: 12, lineHeight: 18, marginTop: 10 },
  botonPrincipal: {
    height: 51,
    backgroundColor: COLORES.verde,
    borderRadius: 12,
    marginTop: 18,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textoBotonPrincipal: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  flecha: { color: '#FFFFFF', fontSize: 21 },
  presionado: { opacity: 0.72 },
  notaSeguridad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 12,
  },
  puntoSeguro: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORES.verde,
    marginTop: 5,
  },
  textoSeguridad: {
    flex: 1,
    color: '#77777E',
    fontSize: 11,
    lineHeight: 17,
  },
});

export default Login;
