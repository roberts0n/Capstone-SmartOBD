import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  construirResultadoJsonDtc,
  type CapturaPruebaDtc,
  type InformePruebaDtc,
} from '../obd/dtc/PruebaDtc';

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
      <Text style={estilos.titulo}>Lectura completa de DTC</Text>
      <Text>
        Un solo proceso consulta confirmados (03), pendientes (07) y permanentes
        (0A). No borra fallas.
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
          p.ejecutando ? 'Lectura en curso…' : 'Leer todos los DTC'
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
          <Text style={estilos.subtitulo}>Resultado JSON</Text>
          <Text selectable style={estilos.json}>
            {JSON.stringify(construirResultadoJsonDtc(p.informe), null, 2)}
          </Text>
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
                  resultadoDtc: c.resultadoDtc,
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
  json: {
    backgroundColor: '#EDF2F7',
    color: '#102A43',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  mono: { fontFamily: 'monospace', color: '#102A43', fontSize: 12 },
});
