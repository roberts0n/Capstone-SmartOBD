import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  clasificarDispositivo,
  nombreDispositivo,
  ordenarCandidatos,
} from '../escaneres/PerfilesEscaner';
import type { InformacionDispositivoBle } from '../tipos/ble';
import type { EscanerGuardado, NivelCandidato } from '../tipos/escaner';

interface Propiedades {
  dispositivos: InformacionDispositivoBle[];
  guardados: EscanerGuardado[];
  seleccionado: string | null;
  ocupado: boolean;
  buscando: boolean;
  cargandoGuardados: boolean;
  errorGuardados: string | null;
  alConectar: (dispositivo: InformacionDispositivoBle) => void;
  alOlvidar: (id: string) => void;
}

const ETIQUETAS: Record<NivelCandidato, string> = {
  guardado: 'Verificado anteriormente',
  probable: 'Posible escáner · indicio por anuncio',
  posible: 'Por comprobar · servicio serial genérico',
  desconocido: 'Dispositivo sin clasificar',
};
const TAMANO_PAGINA = 15;

/** Solo presenta y filtra anuncios; nunca abre conexiones por su cuenta. */
export function SelectorEscaneres({
  dispositivos,
  guardados,
  seleccionado,
  ocupado,
  buscando,
  cargandoGuardados,
  errorGuardados,
  alConectar,
  alOlvidar,
}: Propiedades) {
  const [mostrarTodos, establecerMostrarTodos] = useState(false);
  const [consulta, establecerConsulta] = useState('');
  const [limite, establecerLimite] = useState(TAMANO_PAGINA);
  const candidatos = useMemo(
    () =>
      ordenarCandidatos(
        dispositivos.map(dispositivo =>
          clasificarDispositivo(dispositivo, guardados),
        ),
      ),
    [dispositivos, guardados],
  );
  const desconocidos = candidatos.filter(
    candidato => candidato.nivel === 'desconocido',
  ).length;
  const textoBusqueda = consulta.trim().toLowerCase();
  const coincide = (dispositivo: {
    id: string;
    nombre: string | null;
    nombreLocal: string | null;
  }) =>
    [dispositivo.id, dispositivo.nombre, dispositivo.nombreLocal].some(valor =>
      valor?.toLowerCase().includes(textoBusqueda),
    );
  const visibles = candidatos.filter(
    candidato =>
      candidato.nivel !== 'guardado' &&
      (mostrarTodos || candidato.nivel !== 'desconocido') &&
      coincide(candidato.dispositivo),
  );

  function confirmarOlvido(escaner: EscanerGuardado) {
    Alert.alert(
      'Olvidar escáner',
      `Se eliminará el registro local de ${nombreDispositivo(
        escaner,
      )}. No se borrarán datos del vehículo ni el emparejamiento Bluetooth.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Olvidar',
          style: 'destructive',
          onPress: () => alOlvidar(escaner.id),
        },
      ],
    );
  }

  return (
    <View>
      <Text style={estilos.ayuda}>
        Selecciona solamente tu adaptador. El nombre y los servicios son pistas,
        no una verificación ELM327.
      </Text>
      <TextInput
        accessibilityLabel="Buscar por nombre o identificador"
        placeholder="Buscar por nombre o identificador"
        placeholderTextColor="#64748B"
        value={consulta}
        autoCorrect={false}
        autoCapitalize="none"
        onChangeText={texto => {
          establecerConsulta(texto);
          establecerLimite(TAMANO_PAGINA);
        }}
        style={estilos.buscador}
      />
      <Text style={estilos.titulo}>
        Mis escáneres verificados ({guardados.length})
      </Text>
      {cargandoGuardados && (
        <Text style={estilos.ayuda}>Cargando registros del teléfono…</Text>
      )}
      {errorGuardados && (
        <Text style={estilos.advertencia}>
          No se pudieron actualizar los guardados: {errorGuardados}. Puedes
          seguir buscando y conectar manualmente.
        </Text>
      )}
      {!cargandoGuardados && guardados.length === 0 && (
        <Text style={estilos.ayuda}>
          Conecta tu adaptador, elige sus canales y usa “Verificar y guardar ·
          ATI”.
        </Text>
      )}
      {guardados.filter(coincide).map(escaner => {
        const anuncio = dispositivos.find(
          dispositivo => dispositivo.id === escaner.id,
        );
        return (
          <View key={escaner.id} style={estilos.guardado}>
            <Text style={estilos.nombre}>{nombreDispositivo(escaner)}</Text>
            <Text selectable style={estilos.identificador}>
              {escaner.id}
            </Text>
            <Text style={estilos.ayuda}>
              {escaner.identificacionElm} · verificado anteriormente
            </Text>
            <Text style={estilos.ayuda}>
              {anuncio
                ? 'Visto en esta búsqueda'
                : 'No visto en esta búsqueda; podría estar apagado o conectado'}
            </Text>
            <View style={estilos.fila}>
              <Accion
                etiqueta={`Conectar a ${nombreDispositivo(escaner)}`}
                deshabilitado={ocupado || cargandoGuardados}
                alPulsar={() =>
                  alConectar(
                    anuncio ?? {
                      id: escaner.id,
                      nombre: escaner.nombre,
                      nombreLocal: escaner.nombreLocal,
                      rssi: null,
                    },
                  )
                }
              />
              <Accion
                etiqueta={`Olvidar ${nombreDispositivo(escaner)}`}
                deshabilitado={ocupado}
                alPulsar={() => confirmarOlvido(escaner)}
              />
            </View>
          </View>
        );
      })}
      <Text style={estilos.titulo}>
        {mostrarTodos ? 'Todos los dispositivos BLE' : 'Candidatos a escáner'}
      </Text>
      <Text style={estilos.ayuda}>
        {candidatos.length - desconocidos} candidatos · {dispositivos.length}{' '}
        detectados · {desconocidos} sin clasificar
      </Text>
      <Accion
        etiqueta={
          mostrarTodos
            ? 'Mostrar solo candidatos'
            : `Mostrar todos (${dispositivos.length})`
        }
        alPulsar={() => {
          establecerMostrarTodos(!mostrarTodos);
          establecerLimite(TAMANO_PAGINA);
        }}
      />
      {visibles.length === 0 && (
        <Text style={estilos.ayuda}>
          {buscando ? 'Buscando durante 12 segundos… ' : ''}
          {mostrarTodos
            ? 'No hay dispositivos nuevos que coincidan con la búsqueda.'
            : 'No hay candidatos nuevos visibles. Prueba “Mostrar todos” o busca por nombre. Los guardados aparecen arriba.'}
        </Text>
      )}
      {visibles.slice(0, limite).map(candidato => (
        <Pressable
          key={candidato.dispositivo.id}
          accessibilityRole="button"
          accessibilityLabel={`Conectar a ${nombreDispositivo(
            candidato.dispositivo,
          )} ${candidato.dispositivo.id}`}
          accessibilityState={{
            disabled: ocupado,
            selected: seleccionado === candidato.dispositivo.id,
          }}
          disabled={ocupado}
          onPress={() => alConectar(candidato.dispositivo)}
          style={[
            estilos.tarjeta,
            seleccionado === candidato.dispositivo.id && estilos.seleccionada,
            ocupado && estilos.deshabilitado,
          ]}
        >
          <Text style={estilos.nombre}>
            {nombreDispositivo(candidato.dispositivo)}
          </Text>
          <Text style={estilos.identificador}>{candidato.dispositivo.id}</Text>
          <Text style={estilos.etiqueta}>{ETIQUETAS[candidato.nivel]}</Text>
          {candidato.motivos.map(motivo => (
            <Text key={motivo} style={estilos.ayuda}>
              {motivo}
            </Text>
          ))}
          <Text style={estilos.ayuda}>
            Señal:{' '}
            {candidato.dispositivo.rssi == null
              ? 'sin dato'
              : `${candidato.dispositivo.rssi} dBm`}
          </Text>
        </Pressable>
      ))}
      {visibles.length > limite && (
        <Accion
          etiqueta={`Mostrar ${Math.min(
            TAMANO_PAGINA,
            visibles.length - limite,
          )} más (${visibles.length - limite} restantes)`}
          alPulsar={() => establecerLimite(limite + TAMANO_PAGINA)}
        />
      )}
    </View>
  );
}

function Accion({
  etiqueta,
  alPulsar,
  deshabilitado = false,
}: {
  etiqueta: string;
  alPulsar: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={alPulsar}
      style={[estilos.boton, deshabilitado && estilos.deshabilitado]}
    >
      <Text style={estilos.textoBoton}>{etiqueta}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  titulo: {
    color: '#102A43',
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  ayuda: { color: '#486581', marginVertical: 3, fontSize: 13 },
  buscador: {
    borderWidth: 1,
    borderColor: '#9FB3C8',
    borderRadius: 8,
    padding: 10,
    color: '#102A43',
    marginTop: 8,
  },
  guardado: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#7BB798',
    backgroundColor: '#F0FAF4',
    borderRadius: 8,
    marginBottom: 8,
  },
  tarjeta: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#BCCCDC',
    borderRadius: 8,
    marginVertical: 4,
  },
  seleccionada: { borderColor: '#1367A7', backgroundColor: '#E8F4FD' },
  nombre: { color: '#102A43', fontWeight: '700', fontSize: 16 },
  identificador: { color: '#334E68', fontFamily: 'monospace', fontSize: 12 },
  etiqueta: { color: '#0B4F82', fontWeight: '600', marginTop: 4 },
  advertencia: { color: '#9A3412' },
  fila: { flexDirection: 'row', flexWrap: 'wrap' },
  boton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1367A7',
    padding: 10,
    borderRadius: 6,
    marginVertical: 5,
    marginRight: 6,
  },
  textoBoton: { color: '#FFFFFF', fontWeight: '600' },
  deshabilitado: { opacity: 0.5 },
});
