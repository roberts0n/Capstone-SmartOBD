import {
  useTema,
} from '../tema/TemaAplicacion';
import { crearEstilosTematicos } from '../tema/tokensTema';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alCerrarSesion: () => Promise<void>;
  alAbrirPruebas?: () => void;
}

const NOMBRES_ROL = {
  administrador: 'Administrador',
  recepcion: 'Recepción',
  mecanico: 'Mecánico',
};

export function Cuenta({
  sesion,
  alCerrarSesion,
  alAbrirPruebas,
}: Propiedades) {
  const { modo, colores, cambiarModo } = useTema();
  const oscuro = modo === 'oscuro';

  return (
    <View style={estilos.pantalla}>
      <View style={estilos.avatar}>
        <Text style={estilos.inicial}>
          {sesion.nombre.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={estilos.nombre}>{sesion.nombre}</Text>
      <Text style={estilos.correo}>{sesion.correo}</Text>

      <View style={estilos.tarjeta}>
        <Dato etiqueta="Rol" valor={NOMBRES_ROL[sesion.perfil]} />
        <View style={estilos.separador} />
        <Dato etiqueta="Taller" valor={sesion.taller} />
        <View style={estilos.separador} />
        <Dato etiqueta="Estado" valor="Cuenta activa" destacado />
      </View>

      <View style={estilos.filaTema}>
        <View style={estilos.iconoTema}>
          <Text style={estilos.textoIconoTema}>{oscuro ? '☾' : '☀'}</Text>
        </View>
        <View style={estilos.descripcionTema}>
          <Text style={estilos.tituloTema}>Modo oscuro</Text>
          <Text style={estilos.estadoTema}>
            {oscuro ? 'Activado' : 'Desactivado'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Modo oscuro"
          accessibilityRole="switch"
          onValueChange={activo => {
            cambiarModo(activo ? 'oscuro' : 'claro').catch(() => undefined);
          }}
          thumbColor="#FFFFFF"
          trackColor={{ false: colores.borde, true: colores.primario }}
          value={oscuro}
        />
      </View>

      {alAbrirPruebas ? (
        <Pressable
          accessibilityRole="button"
          onPress={alAbrirPruebas}
          style={estilos.pruebas}
        >
          <Text style={estilos.valorDestacado}>Pruebas técnicas</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={alCerrarSesion}
        style={estilos.boton}
      >
        <Text style={estilos.textoBoton}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <View style={estilos.dato}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text style={[estilos.valor, destacado && estilos.valorDestacado]}>
        {valor}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create(crearEstilosTematicos({
  pantalla: {
    flex: 1,
    backgroundColor: '#0D0D0E',
    paddingHorizontal: 20,
    paddingTop: 34,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 25,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#153B32',
    borderWidth: 1,
    borderColor: '#2D6B5B',
  },
  inicial: { color: '#6EE7C3', fontSize: 29, fontWeight: '800' },
  nombre: {
    color: '#F4F4F5',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 15,
  },
  correo: { color: '#8F8F97', fontSize: 13, textAlign: 'center', marginTop: 5 },
  tarjeta: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 18,
    paddingHorizontal: 16,
    marginTop: 30,
  },
  dato: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
  },
  etiqueta: { color: '#85858C', fontSize: 12 },
  valor: {
    flex: 1,
    color: '#E7E7EA',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  valorDestacado: { color: '#26945B' },
  separador: { height: 1, backgroundColor: '#29292D' },
  filaTema: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 18,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  iconoTema: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#11241F',
  },
  textoIconoTema: { color: '#5BE0BB', fontSize: 20 },
  descripcionTema: { flex: 1, marginLeft: 12 },
  tituloTema: { color: '#F4F4F5', fontSize: 15, fontWeight: '700' },
  estadoTema: { color: '#85858C', fontSize: 12, marginTop: 4 },
  boton: {
    minHeight: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#5A3030',
    borderRadius: 13,
    backgroundColor: '#241616',
    marginTop: 20,
  },
  textoBoton: { color: '#FF9C94', fontSize: 14, fontWeight: '700' },
  pruebas: {
    minHeight: 48,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#303034',
  },
}));
