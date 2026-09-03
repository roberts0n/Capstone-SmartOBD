import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOGO_PIDS_MODE_01 } from '../obd/CatalogoPidsMode01';
import type { CategoriaPid } from '../obd/mode01/TiposPid';
import type { ResultadoDeteccionPids } from '../tipos/ble';

const CATEGORIAS: CategoriaPid[] = [
  'Motor y movimiento',
  'Temperaturas',
  'Combustible y emisiones',
  'Oxigeno y mezcla',
  'Estados y configuracion',
];

export function PanelPidsCompatibles({
  deteccion,
  deshabilitado,
  alConsultar,
}: {
  deteccion: ResultadoDeteccionPids | null;
  deshabilitado: boolean;
  alConsultar: (comando: string) => void;
}) {
  if (!deteccion) {
    return (
      <Text style={estilos.ayuda}>
        Ejecuta “Detectar PID compatibles” para mostrar los botones de este
        vehículo.
      </Text>
    );
  }
  // Se cruza con el catalogo real; la UI no mantiene una segunda lista manual.
  const disponibles = new Set(deteccion.pidsSoportados);
  const definiciones = CATALOGO_PIDS_MODE_01.filter(definicion =>
    disponibles.has(definicion.comando),
  );
  const conocidos = new Set(definiciones.map(definicion => definicion.comando));
  const pendientes = [...disponibles].filter(pid => !conocidos.has(pid));
  return (
    <View>
      <Text style={estilos.titulo}>
        PID compatibles: {disponibles.size} · Traducibles: {definiciones.length}
      </Text>
      <Text style={estilos.ayuda}>
        Capacidades combinadas de las ECU que responden. Compatibilidad
        declarada no significa lectura validada. Las consultas se hacen al
        pulsar cada botón.
      </Text>
      {disponibles.size === 0 ? (
        <Text style={estilos.ayuda}>
          El vehículo no declaró PID de datos en esta detección.
        </Text>
      ) : null}
      {CATEGORIAS.map(categoria => {
        const grupo = definiciones.filter(
          definicion => definicion.categoria === categoria,
        );
        return grupo.length ? (
          <View key={categoria}>
            <Text style={estilos.titulo}>{categoria}</Text>
            <View style={estilos.fila}>
              {grupo.map(definicion => (
                <Pressable
                  key={definicion.comando}
                  accessibilityRole="button"
                  accessibilityLabel={`${definicion.nombre} · ${definicion.comando}`}
                  accessibilityState={{ disabled: deshabilitado }}
                  disabled={deshabilitado}
                  onPress={() => {
                    if (!deshabilitado) {
                      alConsultar(definicion.comando);
                    }
                  }}
                  style={[
                    estilos.boton,
                    deshabilitado && estilos.deshabilitado,
                  ]}
                >
                  <Text style={estilos.textoBoton}>
                    {definicion.nombre} · {definicion.comando}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null;
      })}
      {pendientes.length ? (
        <Text style={estilos.pendientes}>
          Detectados, pendientes de interpretación: {pendientes.join(', ')}. No
          se presentan como lecturas numéricas.
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  titulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#17324d',
    marginTop: 12,
    marginBottom: 8,
  },
  ayuda: { color: '#536779', marginVertical: 8, lineHeight: 21 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boton: {
    backgroundColor: '#2f659a',
    borderRadius: 10,
    padding: 12,
    maxWidth: '100%',
  },
  textoBoton: { color: '#fff', fontWeight: '600' },
  deshabilitado: { opacity: 0.45 },
  pendientes: {
    color: '#785400',
    backgroundColor: '#fff5d8',
    padding: 12,
    marginTop: 12,
    borderRadius: 8,
  },
});
