import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PerfilTaller, SesionTaller } from '../tipos/usuarioTaller';

interface PropiedadesInicio {
  sesion: SesionTaller;
  alAbrirEscaner: () => void;
  alAbrirRegistro: () => void;
  alAbrirRecepcion: () => void;
  alAbrirCuenta: () => void;
}

type DestinoInicio = 'registro' | 'recepcion' | 'escaner';

interface ContenidoPerfil {
  rol: string;
  etiqueta: string;
  titulo: string;
  descripcion: string;
  boton: string;
  destino: DestinoInicio;
  tituloGuia: string;
  descripcionGuia: string;
  pasos: Array<{ titulo: string; descripcion: string }>;
  tituloNota: string;
  nota: string;
}

const CONTENIDO: Record<PerfilTaller, ContenidoPerfil> = {
  administrador: {
    rol: 'Administración',
    etiqueta: 'TU EQUIPO',
    titulo: 'Dale la bienvenida a tu equipo',
    descripcion:
      'Habilita el ingreso para el personal de recepción y el de mecánica. Después, define qué tareas le corresponden a cada uno dentro del taller.',
    boton: 'Agregar integrante',
    destino: 'registro',
    tituloGuia: 'Cada persona, con su acceso',
    descripcionGuia: 'Esto es lo que necesitas para incorporar a alguien.',
    pasos: [
      {
        titulo: 'Completa sus datos',
        descripcion: 'Ingresa su nombre y correo para crear la cuenta.',
      },
      {
        titulo: 'Elige su rol',
        descripcion: 'Selecciona Recepción o Mecánico según su trabajo.',
      },
      {
        titulo: 'Entrega el acceso',
        descripcion:
          'Comparte el correo correspondiente. La persona deberá cambiarla al entrar.',
      },
    ],
    tituloNota: 'Las cuentas quedan asociadas a tu taller',
    nota: 'Cada integrante tendrá las pantallas y acciones correspondientes a su rol.',
  },
  recepcion: {
    rol: 'Recepción',
    etiqueta: 'INGRESO DE VEHÍCULOS',
    titulo: 'Para un buen servicio empieza por escuchar al conductor',
    descripcion:
      'Registra al cliente, identifica su vehículo y anota qué le ocurre. Así podrás preparar el caso antes de entregarlo al mecánico.',
    boton: 'Ir a recepción',
    destino: 'recepcion',
    tituloGuia: 'Del ingreso al caso',
    descripcionGuia: 'Sigue el proceso desde el espacio de Recepción.',
    pasos: [
      {
        titulo: 'Busca al cliente y su vehículo',
        descripcion:
          'Si aún no están registrados, puedes agregarlos al preparar la orden.',
      },
      {
        titulo: 'Cuenta el motivo de ingreso',
        descripcion: 'Anota el problema que comenta el cliente y crea el caso.',
      },
      {
        titulo: 'Prepara la revisión',
        descripcion:
          'Desde el detalle puedes capturar una lectura inicial y asignar un mecánico.',
      },
    ],
    tituloNota: '¿Necesitas retomar un ingreso?',
    nota: 'En Casos de recepción puedes consultar los registros y volver al detalle de cada caso.',
  },
  mecanico: {
    rol: 'Mecánico',
    etiqueta: 'REVISIÓN DEL VEHÍCULO',
    titulo: 'Empieza por lo que dice el vehículo',
    descripcion:
      'Prepara la conexión con el adaptador del vehículo antes de iniciar la revisión.',
    boton: 'Conectar escáner',
    destino: 'escaner',
    tituloGuia: 'Antes de hacer una lectura',
    descripcionGuia: 'Prepara el adaptador y la conexión Bluetooth.',
    pasos: [
      {
        titulo: 'Prepara el vehículo',
        descripcion:
          'Conecta el adaptador ELM327 al puerto OBD-II y enciende el contacto.',
      },
      {
        titulo: 'Activa Bluetooth',
        descripcion:
          'Concede los permisos necesarios para buscar el adaptador.',
      },
      {
        titulo: 'Selecciona el escáner',
        descripcion:
          'La aplicación verificará la comunicación automáticamente.',
      },
    ],
    tituloNota: 'Los datos ayudan a orientar la revisión',
    nota: 'Contrasta las lecturas con los síntomas y tus comprobaciones. Un código de falla, por sí solo, no confirma qué pieza hay que cambiar.',
  },
};

export function Inicio({
  sesion,
  alAbrirEscaner,
  alAbrirRegistro,
  alAbrirRecepcion,
  alAbrirCuenta,
}: PropiedadesInicio) {
  const contenido = CONTENIDO[sesion.perfil];
  const destinos: Record<DestinoInicio, () => void> = {
    registro: alAbrirRegistro,
    recepcion: alAbrirRecepcion,
    escaner: alAbrirEscaner,
  };

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      showsVerticalScrollIndicator={false}
    >
      <View style={estilos.cabecera}>
        <View style={estilos.identidad}>
          <Text style={estilos.taller}>{sesion.taller}</Text>
          <Text style={estilos.saludo}>Hola, {sesion.nombre}</Text>
          <Text style={estilos.rol}>{contenido.rol}</Text>
        </View>
        <Pressable
          accessibilityLabel="Abrir cuenta"
          accessibilityRole="button"
          onPress={alAbrirCuenta}
          style={({ pressed }) => [
            estilos.avatar,
            pressed && estilos.presionado,
          ]}
        >
          <Text style={estilos.inicial}>
            {sesion.nombre.charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <View style={estilos.tarjetaPrincipal}>
        <View style={estilos.encabezadoTarjeta}>
          <View style={estilos.acento} />
          <Text style={estilos.etiqueta}>{contenido.etiqueta}</Text>
        </View>
        <Text style={estilos.tituloPrincipal}>{contenido.titulo}</Text>
        <Text style={estilos.descripcionPrincipal}>
          {contenido.descripcion}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={destinos[contenido.destino]}
          style={({ pressed }) => [
            estilos.botonPrincipal,
            pressed && estilos.presionado,
          ]}
        >
          <Text style={estilos.textoBoton}>{contenido.boton}</Text>
          <Text accessible={false} style={estilos.flecha}>
            →
          </Text>
        </Pressable>
      </View>

      <View style={estilos.cabeceraGuia}>
        <Text style={estilos.tituloGuia}>{contenido.tituloGuia}</Text>
        <Text style={estilos.descripcionGuia}>{contenido.descripcionGuia}</Text>
      </View>
      <View style={estilos.guia}>
        {contenido.pasos.map((paso, indice) => (
          <View
            key={paso.titulo}
            style={[estilos.paso, indice > 0 && estilos.pasoSeparado]}
          >
            <View style={estilos.numeroPaso}>
              <Text style={estilos.numero}>{indice + 1}</Text>
            </View>
            <View style={estilos.textoPaso}>
              <Text style={estilos.tituloPaso}>{paso.titulo}</Text>
              <Text style={estilos.descripcionPaso}>{paso.descripcion}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={estilos.nota}>
        <View style={estilos.lineaNota} />
        <View style={estilos.textoNota}>
          <Text style={estilos.tituloNota}>{contenido.tituloNota}</Text>
          <Text style={estilos.descripcionNota}>{contenido.nota}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  identidad: { flex: 1, paddingRight: 16 },
  taller: { color: '#9CA3A1', fontSize: 12, lineHeight: 18, marginBottom: 6 },
  saludo: { color: '#F4F4F5', fontSize: 25, lineHeight: 32, fontWeight: '700' },
  rol: { color: '#5BE0BB', fontSize: 12, lineHeight: 18, marginTop: 6 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#15352C',
    borderWidth: 1,
    borderColor: '#2C584A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { color: '#A6EAD5', fontWeight: '700', fontSize: 18 },
  tarjetaPrincipal: {
    backgroundColor: '#13241E',
    borderWidth: 1,
    borderColor: '#294D3F',
    borderRadius: 24,
    padding: 22,
  },
  encabezadoTarjeta: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  acento: { width: 18, height: 3, borderRadius: 2, backgroundColor: '#5BE0BB' },
  etiqueta: {
    flex: 1,
    color: '#8ACDB7',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  tituloPrincipal: {
    color: '#F4F8F6',
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 17,
  },
  descripcionPrincipal: {
    color: '#B0C3BA',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  botonPrincipal: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10A37F',
    borderRadius: 14,
    paddingHorizontal: 17,
    paddingVertical: 13,
    marginTop: 24,
  },
  textoBoton: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    paddingRight: 12,
  },
  flecha: { color: '#FFFFFF', fontSize: 23 },
  presionado: { opacity: 0.72 },
  cabeceraGuia: { marginTop: 30, marginBottom: 16 },
  tituloGuia: {
    color: '#F0F0F2',
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },
  descripcionGuia: {
    color: '#98989F',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },
  guia: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2A2A2E',
    borderRadius: 20,
    paddingHorizontal: 18,
  },
  paso: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 20 },
  pasoSeparado: { borderTopWidth: 1, borderTopColor: '#2A2A2E' },
  numeroPaso: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#242C28',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  numero: { color: '#9BD2BD', fontSize: 12, fontWeight: '700' },
  textoPaso: { flex: 1 },
  tituloPaso: {
    color: '#EAEAEC',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  descripcionPaso: {
    color: '#A1A1A8',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },
  nota: { flexDirection: 'row', marginTop: 24, paddingHorizontal: 3 },
  lineaNota: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#345B4A',
    marginRight: 13,
  },
  textoNota: { flex: 1 },
  tituloNota: {
    color: '#C8D6CF',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  descripcionNota: {
    color: '#989F9B',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },
});

export default Inicio;
