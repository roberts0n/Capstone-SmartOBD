import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  listarCasosRecepcion,
  obtenerCasoRecepcion,
  type CasoRecepcion,
  type ConsultaCasosRecepcion,
} from '../casos/ServicioCasosRecepcion';
import type { EstadoCasoDiagnostico } from '../casos/TiposCasoDiagnostico';

interface Propiedades {
  alAbrirCaso: (caso: CasoRecepcion) => void;
  alVolver: () => void;
  consultaInicial?: ConsultaCasosRecepcion;
  alCambiarConsulta?: (consulta: ConsultaCasosRecepcion) => void;
}

export function CasosRecepcion({
  alAbrirCaso,
  alVolver,
  consultaInicial,
  alCambiarConsulta,
}: Propiedades) {
  const [casos, establecerCasos] = useState<CasoRecepcion[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [actualizando, establecerActualizando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const numeroConsulta = useRef(0);
  const [busqueda, establecerBusqueda] = useState(
    consultaInicial?.busqueda ?? '',
  );
  const [filtro, establecerFiltro] = useState<ConsultaCasosRecepcion['filtro']>(
    consultaInicial?.filtro ?? 'todos',
  );
  const [pagina, establecerPagina] = useState(
    Math.floor((consultaInicial?.desde ?? 0) / 20),
  );
  const [haySiguiente, establecerHaySiguiente] = useState(false);
  const [abriendo, establecerAbriendo] = useState(false);
  const aperturaEnCurso = useRef(false);
  const numeroApertura = useRef(0);

  useEffect(() => {
    alCambiarConsulta?.({ busqueda, filtro, desde: pagina * 20 });
  }, [alCambiarConsulta, busqueda, filtro, pagina]);

  const cargar = useCallback(
    async (esActualizacion = false) => {
      const consulta = ++numeroConsulta.current;
      if (esActualizacion) establecerActualizando(true);
      else establecerCargando(true);
      establecerError(null);
      try {
        const resultado = await listarCasosRecepcion({
          busqueda,
          filtro,
          desde: pagina * 20,
          limite: 21,
        });
        // si se vuelve a actualizar, no reemplazo el resultado con una lectura anterior
        if (consulta === numeroConsulta.current) {
          establecerCasos(resultado.slice(0, 20));
          establecerHaySiguiente(resultado.length > 20);
        }
      } catch (capturado) {
        if (consulta === numeroConsulta.current)
          establecerError(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudieron cargar los casos.',
          );
      } finally {
        if (consulta === numeroConsulta.current) {
          establecerCargando(false);
          establecerActualizando(false);
        }
      }
    },
    [busqueda, filtro, pagina],
  );

  useEffect(() => {
    establecerCargando(true);
    establecerAbriendo(false);
    aperturaEnCurso.current = false;
    const espera = busqueda.trim()
      ? setTimeout(() => {
          cargar().catch(() => undefined);
        }, 300)
      : undefined;
    if (!espera) cargar().catch(() => undefined);
    return () => {
      if (espera) clearTimeout(espera);
      numeroConsulta.current += 1;
      numeroApertura.current += 1;
    };
  }, [busqueda, cargar]);

  async function abrirCaso(caso: CasoRecepcion) {
    if (aperturaEnCurso.current) return;
    aperturaEnCurso.current = true;
    const apertura = ++numeroApertura.current;
    establecerAbriendo(true);
    const consulta = numeroConsulta.current;
    try {
      const actual = await obtenerCasoRecepcion(caso.id);
      if (
        consulta !== numeroConsulta.current ||
        apertura !== numeroApertura.current
      )
        return;
      if (!actual) throw new Error('El caso ya no esta disponible.');
      alAbrirCaso(actual);
    } catch (capturado) {
      if (consulta === numeroConsulta.current)
        establecerError(
          capturado instanceof Error
            ? capturado.message
            : 'No se pudo abrir el caso.',
        );
    } finally {
      if (apertura === numeroApertura.current) {
        aperturaEnCurso.current = false;
        establecerAbriendo(false);
      }
    }
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={() => cargar(true)}
          tintColor="#13C296"
        />
      }
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
    >
      <Cabecera alVolver={alVolver} />
      <TextInput
        accessibilityLabel="Buscar casos"
        placeholder="Cliente o patente"
        placeholderTextColor="#77777F"
        value={busqueda}
        maxLength={120}
        autoCorrect={false}
        style={estilos.buscador}
        onChangeText={texto => {
          establecerBusqueda(texto);
          establecerPagina(0);
        }}
      />
      <View style={estilos.filtros}>
        {(['todos', 'pendientes', 'asignados', 'cerrados'] as const).map(
          opcion => (
            <Pressable
              key={opcion}
              accessibilityRole="button"
              accessibilityState={{ selected: filtro === opcion }}
              onPress={() => {
                establecerFiltro(opcion);
                establecerPagina(0);
              }}
              style={[
                estilos.filtro,
                filtro === opcion && estilos.filtroActivo,
              ]}
            >
              <Text style={estilos.textoFiltro}>
                {opcion === 'todos'
                  ? 'Todos'
                  : opcion === 'pendientes'
                  ? 'Pendientes'
                  : opcion === 'asignados'
                  ? 'Asignados'
                  : 'Cerrados'}
              </Text>
            </Pressable>
          ),
        )}
      </View>

      {cargando ? (
        <ActivityIndicator color="#13C296" style={estilos.cargando} />
      ) : error ? (
        <View style={estilos.mensaje}>
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => cargar()}>
            <Text style={estilos.reintentar}>Intentar nuevamente</Text>
          </Pressable>
        </View>
      ) : casos.length === 0 ? (
        <View style={estilos.mensaje}>
          <Text style={estilos.sinCasos}>
            {busqueda || filtro !== 'todos' || pagina > 0
              ? 'No hay casos para esta consulta.'
              : 'Todavía no hay casos registrados.'}
          </Text>
        </View>
      ) : (
        <View style={estilos.lista}>
          {casos.map(caso => (
            <TarjetaCaso
              caso={caso}
              key={caso.id}
              alAbrir={() => abrirCaso(caso)}
              deshabilitado={abriendo}
            />
          ))}
        </View>
      )}
      {!cargando && !error ? (
        <View style={estilos.paginacion}>
          <Pressable
            accessibilityRole="button"
            disabled={pagina === 0 || actualizando}
            onPress={() => establecerPagina(actual => actual - 1)}
          >
            <Text
              style={[
                estilos.reintentar,
                pagina === 0 && estilos.deshabilitado,
              ]}
            >
              Anterior
            </Text>
          </Pressable>
          <Text style={estilos.sinCasos}>Página {pagina + 1}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!haySiguiente || actualizando}
            onPress={() => establecerPagina(actual => actual + 1)}
          >
            <Text
              style={[
                estilos.reintentar,
                !haySiguiente && estilos.deshabilitado,
              ]}
            >
              Siguiente
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Cabecera({ alVolver }: { alVolver: () => void }) {
  return (
    <View style={estilos.cabecera}>
      <Pressable
        accessibilityLabel="Volver"
        accessibilityRole="button"
        onPress={alVolver}
        style={estilos.volver}
      >
        <Text style={estilos.flechaVolver}>‹</Text>
      </Pressable>
      <Text style={estilos.titulo}>Casos de recepción</Text>
    </View>
  );
}

function TarjetaCaso({
  caso,
  alAbrir,
  deshabilitado,
}: {
  caso: CasoRecepcion;
  alAbrir: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={alAbrir}
      disabled={deshabilitado}
      style={({ pressed }) => [estilos.tarjeta, pressed && estilos.presionada]}
    >
      <View style={estilos.filaSuperior}>
        <Text style={estilos.cliente}>{caso.cliente}</Text>
        <Text style={estilos.estado}>{nombreEstado(caso.estado)}</Text>
      </View>
      <Text style={estilos.vehiculo}>{caso.vehiculo}</Text>
      <Text style={estilos.patente}>{caso.patente}</Text>
      <Text
        style={[
          estilos.escaneo,
          caso.snapshotIngreso?.estado === 'completo' &&
            estilos.escaneoCompleto,
          caso.snapshotIngreso?.estado === 'parcial' && estilos.escaneoParcial,
        ]}
      >
        {nombreEscaneoInicial(caso.snapshotIngreso)}
      </Text>
      <View style={estilos.filaInferior}>
        <Text style={estilos.datoSecundario}>
          {caso.mecanico ?? 'Sin mecánico asignado'}
        </Text>
        <Text style={estilos.fecha}>{formatearFecha(caso.creadoEn)}</Text>
      </View>
    </Pressable>
  );
}

function nombreEstado(estado: EstadoCasoDiagnostico): string {
  const nombres: Record<EstadoCasoDiagnostico, string> = {
    ingresado: 'Ingresado',
    diagnostico_inicial: 'Diagnóstico inicial',
    asignado: 'Asignado',
    en_revision: 'En revisión',
    diagnosticado: 'Diagnosticado',
    cerrado: 'Cerrado',
  };
  return nombres[estado];
}

function nombreEscaneoInicial(
  snapshot: CasoRecepcion['snapshotIngreso'],
): string {
  if (!snapshot) return 'Sin escaneo inicial';
  return snapshot.estado === 'completo'
    ? 'Escaneo completo'
    : 'Escaneo parcial';
}

function formatearFecha(fecha: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(fecha));
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  buscador: {
    minHeight: 48,
    color: '#F4F4F5',
    backgroundColor: '#171719',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#303034',
    paddingHorizontal: 13,
  },
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 15,
  },
  filtro: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#27272B',
  },
  filtroActivo: { backgroundColor: '#176B56' },
  textoFiltro: { color: '#F4F4F5', fontSize: 12 },
  paginacion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  deshabilitado: { opacity: 0.4 },
  contenido: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  volver: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2C2C30',
  },
  flechaVolver: { color: '#E8E8EA', fontSize: 30, lineHeight: 31 },
  titulo: { color: '#F4F4F5', fontSize: 22, fontWeight: '700' },
  cargando: { marginTop: 50 },
  mensaje: {
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 22,
  },
  sinCasos: { color: '#96969D', fontSize: 13 },
  error: { color: '#FF9C94', fontSize: 12, textAlign: 'center' },
  reintentar: {
    color: '#4DDBB7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
  },
  lista: { gap: 11 },
  tarjeta: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 15,
  },
  presionada: { opacity: 0.75 },
  filaSuperior: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cliente: { flex: 1, color: '#F1F1F3', fontSize: 15, fontWeight: '700' },
  estado: { color: '#66DFBD', fontSize: 10, fontWeight: '700' },
  vehiculo: { color: '#C7C7CC', fontSize: 13, marginTop: 9 },
  patente: { color: '#13C296', fontSize: 12, fontWeight: '700', marginTop: 4 },
  escaneo: { color: '#85858C', fontSize: 11, marginTop: 8 },
  escaneoCompleto: { color: '#66DFBD' },
  escaneoParcial: { color: '#E6B85C' },
  filaInferior: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#303034',
  },
  datoSecundario: { flex: 1, color: '#85858C', fontSize: 11 },
  fecha: { color: '#85858C', fontSize: 11 },
});

export default CasosRecepcion;
