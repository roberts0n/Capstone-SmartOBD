import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CapturaPruebaDtc, InformePruebaDtc } from '../obd/dtc/PruebaDtc';

interface Propiedades {
  informe: InformePruebaDtc | null;
  progreso: string;
  notas: string;
  cargando: boolean;
  ejecutando: boolean;
  guardando: boolean;
  deshabilitado: boolean;
  error: string | null;
  alCambiarNotas: (notas: string) => void;
  alIniciar: () => void;
  alDetener: () => void;
  alGuardar: () => void;
}

/** Componente de presentacion: no conoce servicios BLE ni escribe archivos. */
export function PanelPruebaDtc(p: Propiedades) {
  return (
    <View style={estilos.panel}>
      <Text style={estilos.titulo}>Prueba completa de DTC</Text>
      <Text>
        Consulta 0101, 03, 07 y 0A, con y sin cabeceras. No borra fallas.
        Comparación sobre las mismas capturas.
      </Text>
      <TextInput
        accessibilityLabel="Condiciones de la prueba DTC"
        placeholder="Notas: vehículo, motor encendido/apagado, código y estado en la otra app…"
        value={p.notas}
        onChangeText={p.alCambiarNotas}
        multiline
        maxLength={1000}
        editable={!p.ejecutando}
        style={estilos.notas}
      />
      <Boton
        texto={
          p.ejecutando ? 'Prueba en curso…' : 'Ejecutar prueba completa DTC'
        }
        accion={p.alIniciar}
        deshabilitado={
          p.deshabilitado || p.cargando || p.ejecutando || p.guardando
        }
      />
      {p.ejecutando && (
        <Boton
          texto="Detener después del comando actual"
          accion={p.alDetener}
        />
      )}
      <Text accessibilityLiveRegion="polite" style={estilos.progreso}>
        {p.progreso}
      </Text>
      {p.error && <Text style={estilos.advertencia}>{p.error}</Text>}
      {p.informe && (
        <>
          <Text>
            Captura: {p.informe.inicio}
            {'\n'}Escáner:{' '}
            {p.informe.dispositivo.nombre ?? p.informe.dispositivo.id}
          </Text>
          <Text>
            Estado del lote: {p.informe.estado}. {p.informe.capturas.length}{' '}
            comandos registrados.
          </Text>
          <Text style={estilos.advertencia}>
            “Completada” significa que terminó el lote, no que todas las
            consultas sean válidas. El método original puede inventar códigos.
          </Text>
          {p.informe.advertencias.map((mensaje, i) => (
            <Text key={i} style={estilos.ayuda}>
              • {mensaje}
            </Text>
          ))}
          {p.informe.capturas
            .filter(c => c.comparacion)
            .map(c => (
              <Comparacion
                key={`${p.informe?.inicio}-${c.numero}`}
                captura={c}
              />
            ))}
          <Inspeccion capturas={p.informe.capturas} />
          <Boton
            texto={p.guardando ? 'Guardando…' : 'Guardar informe JSON'}
            accion={p.alGuardar}
            deshabilitado={p.ejecutando || p.guardando || p.cargando}
          />
          <Text style={estilos.ayuda}>
            Elige Descargas u otra carpeta en el selector de Android. El último
            informe se recupera al reabrir la app; una nueva prueba reemplaza
            ese borrador. El JSON puede contener datos del escáner y las notas
            ingresadas.
          </Text>
        </>
      )}
    </View>
  );
}

function Comparacion({ captura }: { captura: CapturaPruebaDtc }) {
  const comparacion = captura.comparacion;
  if (!comparacion) {
    return null;
  }
  const lineas = [
    ['Corregido', comparacion.corregido],
    ['Original · EXPERIMENTAL', comparacion.original],
    ['Por líneas · referencia anterior', comparacion.porLineas],
  ] as const;
  return (
    <View style={estilos.captura}>
      <Text style={estilos.subtitulo}>
        {captura.comando} · {comparacion.corregido.categoria} · {captura.fase}
      </Text>
      {lineas.map(([nombre, resultado]) => (
        <View key={nombre} style={estilos.metodo}>
          <Text style={estilos.subtitulo}>{nombre}</Text>
          <Text>Estado: {resultado.estado}</Text>
          <Text>
            Códigos producidos: {resultado.codigos.join(', ') || '[]'}
          </Text>
          {resultado.advertencias.map((mensaje, i) => (
            <Text key={i} style={estilos.advertencia}>
              {mensaje}
            </Text>
          ))}
        </View>
      ))}
      {captura.error && (
        <Text style={estilos.advertencia}>{captura.error}</Text>
      )}
    </View>
  );
}

function Inspeccion({ capturas }: { capturas: CapturaPruebaDtc[] }) {
  const [visible, establecerVisible] = useState(false);
  return (
    <View>
      <Boton
        texto={
          visible
            ? 'Ocultar inspección cruda'
            : 'Ver inspección cruda de todos los comandos'
        }
        accion={() => establecerVisible(!visible)}
      />
      {visible &&
        capturas.map(c => (
          <View key={c.numero} style={estilos.captura}>
            <Text style={estilos.subtitulo}>
              {c.numero}. {c.comando} · {c.fase}
            </Text>
            <Text selectable style={estilos.mono}>
              {JSON.stringify(
                {
                  contexto: c.contexto,
                  respuestaCruda: c.respuesta?.textoAscii ?? null,
                  error: c.error,
                  ecu: c.comparacion?.corregido.mensajes,
                },
                null,
                2,
              )}
            </Text>
          </View>
        ))}
    </View>
  );
}

function Boton({
  texto,
  accion,
  deshabilitado = false,
}: {
  texto: string;
  accion: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: deshabilitado }}
      onPress={accion}
      disabled={deshabilitado}
      style={[estilos.boton, deshabilitado && estilos.deshabilitado]}
    >
      <Text style={estilos.textoBoton}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  panel: {
    marginVertical: 16,
    padding: 14,
    backgroundColor: '#F0F6FC',
    borderRadius: 12,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#102A43',
    marginBottom: 8,
  },
  subtitulo: { fontWeight: '700', color: '#102A43' },
  notas: {
    borderWidth: 1,
    borderColor: '#829AB1',
    borderRadius: 6,
    padding: 10,
    minHeight: 72,
    marginVertical: 10,
    color: '#102A43',
    textAlignVertical: 'top',
  },
  boton: {
    backgroundColor: '#32669A',
    borderRadius: 7,
    padding: 12,
    marginVertical: 6,
    minHeight: 48,
    justifyContent: 'center',
  },
  textoBoton: { color: '#FFFFFF', fontWeight: '700' },
  deshabilitado: { opacity: 0.45 },
  progreso: { marginVertical: 10, fontWeight: '600', color: '#102A43' },
  advertencia: { color: '#854D0E', marginVertical: 4 },
  ayuda: { color: '#486581', marginVertical: 5 },
  captura: {
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#BCCCDC',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  metodo: { marginVertical: 6 },
  mono: { fontFamily: 'monospace', color: '#102A43', fontSize: 12 },
});
