import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PerfilTaller, SesionTaller } from '../tipos/usuarioTaller';

interface PropiedadesInicio {
  sesion: SesionTaller;
  alAbrirEscaner: () => void;
  alCerrarSesion?: () => void;
}

interface ContenidoPerfil {
  etiqueta: string;
  titulo: string;
  descripcion: string;
  boton: string;
  metricas: Array<{ etiqueta: string; valor: string; color: string }>;
  acciones: Array<{
    codigo: string;
    titulo: string;
    descripcion: string;
    abreEscaner: boolean;
  }>;
}

const ETIQUETAS_PERFIL: Record<PerfilTaller, string> = {
  administrador: 'Administrador',
  recepcion: 'Recepcion',
  mecanico: 'Mecanico',
};

const CONTENIDO: Record<PerfilTaller, ContenidoPerfil> = {
  administrador: {
    etiqueta: 'PANEL DE ADMINISTRACION',
    titulo: 'Supervisa el taller y mantén la operación conectada.',
    descripcion:
      'Gestiona el acceso del equipo, consulta la actividad general y utiliza el escáner cuando sea necesario.',
    boton: 'Abrir escáner OBD-II',
    metricas: [
      { etiqueta: 'Usuarios activos', valor: '1', color: '#58A6FF' },
      { etiqueta: 'Vehículos en taller', valor: '0', color: '#10A37F' },
      { etiqueta: 'Casos abiertos', valor: '0', color: '#F4B860' },
      { etiqueta: 'Alertas pendientes', valor: '—', color: '#FF8A80' },
    ],
    acciones: [
      {
        codigo: 'USR',
        titulo: 'Equipo del taller',
        descripcion: 'Administra invitaciones, roles y accesos',
        abreEscaner: false,
      },
      {
        codigo: 'CASO',
        titulo: 'Actividad general',
        descripcion: 'Consulta los casos diagnósticos del taller',
        abreEscaner: false,
      },
      {
        codigo: 'OBD',
        titulo: 'Escáner técnico',
        descripcion: 'Accede a las herramientas BLE y OBD-II',
        abreEscaner: true,
      },
    ],
  },
  recepcion: {
    etiqueta: 'PANEL DE RECEPCION',
    titulo: 'Recibe el vehiculo y comienza con datos claros.',
    descripcion:
      'Registra el ingreso, conecta el adaptador y entrega al mecanico un diagnostico inicial.',
    boton: 'Iniciar revision con escaner',
    metricas: [
      { etiqueta: 'Vehiculos en espera', valor: '0', color: '#58A6FF' },
      { etiqueta: 'En diagnostico', valor: '0', color: '#10A37F' },
      { etiqueta: 'Listos para entrega', valor: '0', color: '#F4B860' },
      { etiqueta: 'Alertas detectadas', valor: '—', color: '#FF8A80' },
    ],
    acciones: [
      {
        codigo: 'OBD',
        titulo: 'Diagnostico de ingreso',
        descripcion: 'Conecta el escaner y obtiene el estado inicial',
        abreEscaner: true,
      },
      {
        codigo: 'OT',
        titulo: 'Nueva orden de trabajo',
        descripcion: 'Registra cliente, vehiculo y motivo de ingreso',
        abreEscaner: false,
      },
      {
        codigo: 'COLA',
        titulo: 'Vehiculos del dia',
        descripcion: 'Revisa la carga actual del taller',
        abreEscaner: false,
      },
    ],
  },
  mecanico: {
    etiqueta: 'PANEL DEL MECANICO',
    titulo: 'Diagnostica con precision, repara con confianza.',
    descripcion:
      'Accede al ELM327, revisa codigos DTC y consulta los parametros disponibles del motor.',
    boton: 'Conectar escaner OBD-II',
    metricas: [
      { etiqueta: 'Ordenes asignadas', valor: '0', color: '#58A6FF' },
      { etiqueta: 'En diagnostico', valor: '0', color: '#10A37F' },
      { etiqueta: 'DTC pendientes', valor: '—', color: '#FF8A80' },
      { etiqueta: 'Informes guardados', valor: '0', color: '#F4B860' },
    ],
    acciones: [
      {
        codigo: '01',
        titulo: 'Datos en tiempo real',
        descripcion: 'Consulta RPM, temperatura y sensores compatibles',
        abreEscaner: true,
      },
      {
        codigo: 'DTC',
        titulo: 'Codigos de falla',
        descripcion: 'Lee e interpreta las alertas almacenadas',
        abreEscaner: true,
      },
      {
        codigo: 'VIN',
        titulo: 'Identificar vehiculo',
        descripcion: 'Consulta VIN y compatibilidad disponible',
        abreEscaner: true,
      },
    ],
  },
};

export function Inicio({
  sesion,
  alAbrirEscaner,
  alCerrarSesion,
}: PropiedadesInicio) {
  const contenido = CONTENIDO[sesion.perfil];

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
    >
      <View style={estilos.cabecera}>
        <View style={estilos.identidad}>
          <Text style={estilos.taller}>{sesion.taller}</Text>
          <Text style={estilos.saludo}>Hola, {sesion.nombre}</Text>
        </View>
        {alCerrarSesion ? (
          <Pressable
            accessibilityLabel="Cerrar sesion"
            accessibilityRole="button"
            onPress={alCerrarSesion}
            style={estilos.avatar}
          >
            <Text style={estilos.inicial}>
              {sesion.nombre.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={estilos.filaEstados}>
        <View style={estilos.perfilActivo}>
          <View style={estilos.puntoPerfil} />
          <Text style={estilos.textoPerfil}>
            {ETIQUETAS_PERFIL[sesion.perfil]}
          </Text>
        </View>
        <View style={estilos.estadoConexion}>
          <View style={estilos.indicadorDesconectado} />
          <Text style={estilos.textoEstado}>OBD desconectado</Text>
        </View>
      </View>

      <View style={estilos.tarjetaPrincipal}>
        <View style={estilos.filaSuperiorTarjeta}>
          <View style={estilos.iconoObd}>
            <View style={estilos.puertoObd} />
            <View style={estilos.pinObd} />
          </View>
          <Text style={estilos.etiquetaLista}>{contenido.etiqueta}</Text>
        </View>
        <Text style={estilos.tituloPrincipal}>{contenido.titulo}</Text>
        <Text style={estilos.descripcionPrincipal}>{contenido.descripcion}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={alAbrirEscaner}
          style={({ pressed }) => [
            estilos.botonEscaner,
            pressed && estilos.presionado,
          ]}
        >
          <View style={estilos.puntoBluetooth} />
          <Text style={estilos.textoBotonEscaner}>{contenido.boton}</Text>
          <Text style={estilos.flecha}>→</Text>
        </Pressable>
      </View>

      <View style={estilos.cabeceraSeccion}>
        <Text style={estilos.tituloSeccion}>Actividad del taller</Text>
        <Text style={estilos.textoAuxiliar}>Hoy</Text>
      </View>
      <View style={estilos.cuadriculaMetricas}>
        {contenido.metricas.map(metrica => (
          <Metrica key={metrica.etiqueta} {...metrica} />
        ))}
      </View>

      <View style={estilos.cabeceraSeccion}>
        <Text style={estilos.tituloSeccion}>Herramientas</Text>
        <Text style={estilos.textoAuxiliar}>SmartOBD</Text>
      </View>
      <View style={estilos.listaAcciones}>
        {contenido.acciones.map(accion => (
          <Accion
            key={accion.codigo}
            codigo={accion.codigo}
            titulo={accion.titulo}
            descripcion={accion.descripcion}
            alPresionar={accion.abreEscaner ? alAbrirEscaner : undefined}
          />
        ))}
      </View>

      <View style={estilos.nota}>
        <Text style={estilos.tituloNota}>
          {sesion.perfil === 'recepcion'
            ? 'Antes de recibir el vehiculo'
            : 'Antes de iniciar el diagnostico'}
        </Text>
        <Text style={estilos.textoNota}>
          Confirma los datos del cliente, enciende el contacto y conecta el
          adaptador ELM327. El motor puede permanecer detenido para la deteccion
          inicial.
        </Text>
      </View>
    </ScrollView>
  );
}

function Metrica({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: string;
  color: string;
}) {
  return (
    <View style={estilos.metrica}>
      <View style={[estilos.lineaMetrica, { backgroundColor: color }]} />
      <Text style={estilos.valorMetrica}>{valor}</Text>
      <Text style={estilos.etiquetaMetrica}>{etiqueta}</Text>
    </View>
  );
}

function Accion({
  codigo,
  titulo,
  descripcion,
  alPresionar,
}: {
  codigo: string;
  titulo: string;
  descripcion: string;
  alPresionar?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !alPresionar }}
      disabled={!alPresionar}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.accion,
        !alPresionar && estilos.accionPendiente,
        pressed && estilos.presionado,
      ]}
    >
      <View style={estilos.codigoAccion}>
        <Text style={estilos.textoCodigo}>{codigo}</Text>
      </View>
      <View style={estilos.textoAccion}>
        <Text style={estilos.tituloAccion}>{titulo}</Text>
        <Text style={estilos.descripcionAccion}>{descripcion}</Text>
      </View>
      {alPresionar ? (
        <Text style={estilos.flechaAccion}>›</Text>
      ) : (
        <Text style={estilos.pendiente}>PROX.</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identidad: { flex: 1, paddingRight: 12 },
  taller: {
    color: '#10A37F',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  saludo: { color: '#F4F4F5', fontSize: 25, fontWeight: '700' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1E332E',
    borderWidth: 1,
    borderColor: '#2D5A4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { color: '#6EE7C3', fontWeight: '700', fontSize: 16 },
  filaEstados: { flexDirection: 'row', gap: 8, marginTop: 22, marginBottom: 13 },
  perfilActivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#11241F',
    borderWidth: 1,
    borderColor: '#235E4E',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  puntoPerfil: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10A37F' },
  textoPerfil: { color: '#8BE5CC', fontSize: 11, fontWeight: '700' },
  estadoConexion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  indicadorDesconectado: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#71717A' },
  textoEstado: { color: '#B8B8BE', fontSize: 11, fontWeight: '600' },
  tarjetaPrincipal: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 22,
    padding: 20,
  },
  filaSuperiorTarjeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconoObd: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: '#153B32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  puertoObd: { width: 17, height: 10, borderWidth: 2, borderColor: '#47D7AE', borderRadius: 3 },
  pinObd: { position: 'absolute', bottom: 8, width: 8, height: 2, backgroundColor: '#47D7AE' },
  etiquetaLista: { color: '#47D7AE', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  tituloPrincipal: {
    color: '#F4F4F5',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 18,
  },
  descripcionPrincipal: { color: '#A1A1AA', lineHeight: 21, marginTop: 10 },
  botonEscaner: {
    height: 52,
    backgroundColor: '#10A37F',
    borderRadius: 13,
    paddingHorizontal: 16,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  puntoBluetooth: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4FFF3', marginRight: 10 },
  textoBotonEscaner: { flex: 1, color: '#FFFFFF', fontWeight: '700' },
  flecha: { color: '#FFFFFF', fontSize: 22 },
  presionado: { opacity: 0.72 },
  cabeceraSeccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 11,
  },
  tituloSeccion: { color: '#F4F4F5', fontWeight: '700', fontSize: 17 },
  textoAuxiliar: { color: '#64646B', fontSize: 11 },
  cuadriculaMetricas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metrica: {
    width: '48%',
    minHeight: 102,
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#29292D',
    borderRadius: 16,
    padding: 14,
  },
  lineaMetrica: { width: 22, height: 3, borderRadius: 2, marginBottom: 14 },
  valorMetrica: { color: '#F4F4F5', fontSize: 20, fontWeight: '700' },
  etiquetaMetrica: { color: '#84848C', fontSize: 11, lineHeight: 16, marginTop: 5 },
  listaAcciones: { gap: 9 },
  accion: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#29292D',
    borderRadius: 16,
    padding: 13,
  },
  accionPendiente: { opacity: 0.62 },
  codigoAccion: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#202C37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCodigo: { color: '#75B8FF', fontFamily: 'monospace', fontWeight: '700', fontSize: 11 },
  textoAccion: { flex: 1, marginHorizontal: 12 },
  tituloAccion: { color: '#EDEDEF', fontWeight: '700', fontSize: 14 },
  descripcionAccion: { color: '#818188', fontSize: 11, lineHeight: 16, marginTop: 3 },
  flechaAccion: { color: '#71717A', fontSize: 26 },
  pendiente: { color: '#71717A', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  nota: {
    backgroundColor: '#121E1B',
    borderLeftWidth: 3,
    borderLeftColor: '#10A37F',
    borderRadius: 12,
    padding: 15,
    marginTop: 24,
  },
  tituloNota: { color: '#B8F3E3', fontWeight: '700', fontSize: 13 },
  textoNota: { color: '#8EA69F', fontSize: 12, lineHeight: 18, marginTop: 5 },
});

export default Inicio;
