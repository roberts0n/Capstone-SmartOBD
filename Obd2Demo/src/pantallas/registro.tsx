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
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type {
  NuevoPersonal,
  RolPersonalRegistrable,
} from '../servicios/personalTaller';
import { useTema } from '../tema/TemaAplicacion';
import { crearEstilosTematicos } from '../tema/tokensTema';

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
      establecerError('Ingresa un correo corporativo válido.');
      return;
    }
    if (rol !== 'recepcion' && rol !== 'mecanico') {
      establecerError('Selecciona un rol permitido.');
      return;
    }
    if (contrasenaTemporal.length < 8) {
      establecerError(
        'La contraseña temporal debe tener al menos 8 caracteres.',
      );
      return;
    }
    if (contrasenaTemporal !== confirmacion) {
      establecerError('Las contraseñas no coinciden.');
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
        showsVerticalScrollIndicator={false}
      >
        <MarcaSmartObd />

        <Pressable
          accessibilityLabel="Volver al equipo"
          accessibilityRole="button"
          onPress={alVolver}
          hitSlop={8}
          style={({ pressed }) => [
            estilos.volver,
            pressed && estilos.presionado,
          ]}
        >
          <Text style={estilos.textoVolver}>← VOLVER AL EQUIPO</Text>
        </Pressable>

        <Text style={estilos.titulo}>Registrar empleado</Text>
        <Text style={estilos.descripcionTitulo}>
          Crea credenciales y asigna el rol del nuevo integrante.
        </Text>

        <View style={estilos.tarjetaDatos}>
          <Campo
            etiqueta="Nombre completo"
            valor={nombre}
            alCambiar={establecerNombre}
            placeholder="Ej. Pedro Soto"
            autoComplete="name"
          />
          <Campo
            etiqueta="Correo corporativo"
            valor={correo}
            alCambiar={establecerCorreo}
            placeholder="pedro.s@smartobd.com"
            autoComplete="email"
            teclado="email-address"
          />
          <Campo
            etiqueta="Contraseña temporal"
            valor={contrasenaTemporal}
            alCambiar={establecerContrasenaTemporal}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            segura
          />
          <Campo
            etiqueta="Confirmar contraseña"
            valor={confirmacion}
            alCambiar={establecerConfirmacion}
            placeholder="Repite la contraseña temporal"
            autoComplete="new-password"
            segura
            ultimo
          />
        </View>

        <Text style={estilos.etiquetaSeccion}>ROL DEL EMPLEADO</Text>
        <View style={estilos.roles}>
          <OpcionRol
            activo={rol === 'recepcion'}
            descripcion="Registra clientes, vehículos y órdenes"
            etiqueta="Recepción"
            rol="recepcion"
            alPresionar={() => establecerRol('recepcion')}
          />
          <OpcionRol
            activo={rol === 'mecanico'}
            descripcion="Diagnóstico y reparación en box"
            etiqueta="Mecánico"
            rol="mecanico"
            alPresionar={() => establecerRol('mecanico')}
          />
        </View>

        {rol === 'mecanico' && (
          <View style={estilos.tarjetaEspecialidad}>
            <Campo
              etiqueta="Especialidad (opcional)"
              valor={especialidad}
              alCambiar={establecerEspecialidad}
              placeholder="Ej. Motor, frenos, electricidad"
              autoComplete="off"
              ultimo
            />
          </View>
        )}

        {error && (
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
        )}
        {exito && (
          <View accessibilityRole="alert" style={estilos.cajaExito}>
            <Text style={estilos.tituloExito}>Cuenta creada</Text>
            <Text selectable style={estilos.exito}>
              {exito}
            </Text>
          </View>
        )}

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
            {enviando ? 'Registrando empleado...' : 'Registrar empleado'}
          </Text>
          <IconoAgregar color="#FEFEFE" />
        </Pressable>

        <Text style={estilos.notaAcceso}>
          La persona deberá cambiar la contraseña temporal en su primer ingreso.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MarcaSmartObd() {
  return (
    <View style={estilos.marca}>
      <View style={estilos.logo}>
        <View style={estilos.arcoLogo} />
        <View style={estilos.agujaLogo} />
        <View style={estilos.baseLogo} />
      </View>
      <View>
        <Text style={estilos.nombreMarca}>
          Smart<Text style={estilos.nombreMarcaAzul}>OBD</Text>
        </Text>
        <Text style={estilos.bajadaMarca}>PARA TALLERES</Text>
      </View>
    </View>
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
  ultimo,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  placeholder: string;
  autoComplete: 'name' | 'email' | 'off' | 'new-password';
  teclado?: 'email-address';
  segura?: boolean;
  ultimo?: boolean;
}) {
  const { colores } = useTema();
  const [visible, establecerVisible] = useState(false);

  return (
    <View style={[estilos.grupoCampo, ultimo && estilos.grupoCampoUltimo]}>
      <Text style={estilos.etiquetaCampo}>{etiqueta.toUpperCase()}</Text>
      <View style={estilos.contenedorEntrada}>
        <TextInput
          accessibilityLabel={etiqueta}
          autoCapitalize={teclado || segura ? 'none' : 'words'}
          autoComplete={autoComplete}
          keyboardType={teclado}
          onChangeText={alCambiar}
          placeholder={placeholder}
          placeholderTextColor={colores.textoSecundario}
          secureTextEntry={segura && !visible}
          style={[estilos.entrada, segura && estilos.entradaSegura]}
          value={valor}
        />
        {segura && (
          <Pressable
            accessibilityLabel={
              visible ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
            accessibilityRole="button"
            onPress={() => establecerVisible(actual => !actual)}
            hitSlop={8}
            style={estilos.botonVisibilidad}
          >
            <IconoOjo color={colores.textoSecundario} visible={visible} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function OpcionRol({
  activo,
  etiqueta,
  descripcion,
  rol,
  alPresionar,
}: {
  activo: boolean;
  etiqueta: string;
  descripcion: string;
  rol: RolPersonalRegistrable;
  alPresionar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: activo }}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.opcionRol,
        activo && estilos.opcionRolActiva,
        pressed && estilos.presionado,
      ]}
    >
      <View style={[estilos.iconoRol, activo && estilos.iconoRolActivo]}>
        <IconoRol rol={rol} color="#55C7FF" />
      </View>
      <View style={estilos.textoRol}>
        <Text style={estilos.nombreRol}>{etiqueta}</Text>
        <Text style={estilos.descripcionRol}>{descripcion}</Text>
      </View>
      <View style={[estilos.radio, activo && estilos.radioActivo]}>
        {activo && <Text style={estilos.check}>✓</Text>}
      </View>
    </Pressable>
  );
}

function IconoRol({
  rol,
  color,
}: {
  rol: RolPersonalRegistrable;
  color: string;
}) {
  if (rol === 'recepcion') {
    return (
      <Svg width={21} height={21} viewBox="0 0 24 24">
        <Rect
          x="6"
          y="5"
          width="12"
          height="15"
          rx="2"
          fill="none"
          stroke={color}
          strokeWidth="1.7"
        />
        <Path
          d="M9 5V3h6v2M9 10h6M9 14h6"
          fill="none"
          stroke={color}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Path
        d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-3 3-3-3Z"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconoOjo({ color, visible }: { color: string; visible: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
      />
      <Circle
        cx="12"
        cy="12"
        r="2.5"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
      />
      {visible && (
        <Path
          d="M4 4l16 16"
          stroke={color}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

function IconoAgregar({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Circle
        cx="9"
        cy="8"
        r="3"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
      />
      <Path
        d="M4 20v-1a5 5 0 0 1 10 0v1M18 9v6M15 12h6"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const estilos = StyleSheet.create(
  crearEstilosTematicos({
    pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
    contenido: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 34,
    },
    marca: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    logo: {
      width: 39,
      height: 39,
      borderRadius: 13,
      backgroundColor: '#071329',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    arcoLogo: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.7,
      borderColor: '#287FFF',
      borderBottomColor: 'transparent',
      transform: [{ rotate: '-18deg' }],
    },
    agujaLogo: {
      position: 'absolute',
      width: 8,
      height: 2,
      borderRadius: 2,
      backgroundColor: '#287FFF',
      transform: [{ rotate: '-52deg' }, { translateX: 2 }],
    },
    baseLogo: {
      position: 'absolute',
      bottom: 0,
      width: 23,
      height: 3,
      borderRadius: 3,
      backgroundColor: '#287FFF',
    },
    nombreMarca: {
      color: '#F4F4F5',
      fontSize: 15,
      fontWeight: '800',
      marginLeft: 11,
    },
    nombreMarcaAzul: { color: '#287FFF' },
    bajadaMarca: {
      color: '#85858C',
      fontSize: 7,
      fontWeight: '700',
      letterSpacing: 2.5,
      marginLeft: 11,
      marginTop: 2,
    },
    volver: { alignSelf: 'flex-start' },
    textoVolver: {
      color: '#287FFF',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 2.1,
    },
    titulo: { color: '#F4F4F5', fontSize: 24, fontWeight: '800', marginTop: 9 },
    descripcionTitulo: {
      color: '#A1A1AA',
      fontSize: 11,
      lineHeight: 17,
      marginTop: 6,
    },
    tarjetaDatos: {
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 18,
      padding: 16,
      marginTop: 20,
    },
    grupoCampo: { marginBottom: 18 },
    grupoCampoUltimo: { marginBottom: 0 },
    etiquetaCampo: {
      color: '#85858C',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1.1,
      marginBottom: 9,
    },
    contenedorEntrada: { position: 'relative' },
    entrada: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: '#2A2A2E',
      borderRadius: 13,
      backgroundColor: '#101011',
      color: '#F4F4F5',
      fontSize: 12,
      paddingHorizontal: 13,
    },
    entradaSegura: { paddingRight: 48 },
    botonVisibilidad: {
      position: 'absolute',
      right: 13,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    etiquetaSeccion: {
      color: '#85858C',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginTop: 20,
      marginBottom: 9,
    },
    roles: { gap: 8 },
    opcionRol: {
      minHeight: 61,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#303034',
      borderRadius: 15,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    opcionRolActiva: { backgroundColor: '#153B32', borderColor: '#10A37F' },
    iconoRol: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: '#153B32',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconoRolActivo: { backgroundColor: '#287FFF' },
    textoRol: { flex: 1, marginHorizontal: 11 },
    nombreRol: { color: '#F0F0F2', fontSize: 13, fontWeight: '800' },
    descripcionRol: { color: '#85858C', fontSize: 9, marginTop: 3 },
    radio: {
      width: 19,
      height: 19,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#45454B',
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActivo: { backgroundColor: '#287FFF', borderColor: '#287FFF' },
    check: { color: '#FEFEFE', fontSize: 11, fontWeight: '900' },
    tarjetaEspecialidad: {
      backgroundColor: '#171719',
      borderWidth: 1,
      borderColor: '#10A37F',
      borderRadius: 17,
      padding: 15,
      marginTop: 12,
    },
    error: { color: '#FF9C94', fontSize: 11, lineHeight: 17, marginTop: 13 },
    cajaExito: {
      backgroundColor: '#11241F',
      borderWidth: 1,
      borderColor: '#235E4E',
      borderRadius: 12,
      padding: 12,
      marginTop: 13,
    },
    tituloExito: {
      color: '#B8F3E3',
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 4,
    },
    exito: { color: '#7EE2C5', fontSize: 11, lineHeight: 17 },
    boton: {
      minHeight: 49,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#10A37F',
      borderRadius: 14,
      paddingHorizontal: 16,
      marginTop: 18,
    },
    textoBoton: { color: '#FEFEFE', fontSize: 12, fontWeight: '800' },
    presionado: { opacity: 0.78, transform: [{ scale: 0.99 }] },
    deshabilitado: { opacity: 0.55 },
    notaAcceso: {
      color: '#85858C',
      fontSize: 9,
      lineHeight: 14,
      textAlign: 'center',
      marginTop: 10,
      paddingHorizontal: 12,
    },
  }),
);

export default Registro;
