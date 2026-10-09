import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { obtenerCliente } from '../clientes/ServicioClientes';
import type { ClienteTaller } from '../clientes/TiposCliente';
import { listarVehiculosCliente } from '../vehiculos/ServicioVehiculos';
import type { VehiculoTaller } from '../vehiculos/TiposVehiculo';
import {
  listarCasosVehiculo,
  obtenerCasoRecepcion,
  tieneDiagnosticoIngresoPendiente,
  type CasoRecepcion,
} from '../casos/ServicioCasosRecepcion';
import type { EstadoCasoDiagnostico } from '../casos/TiposCasoDiagnostico';

interface Propiedades {
  clienteId: string;
  vehiculoAbiertoId?: string | null;
  alCambiarVehiculoAbierto?: (vehiculoId: string | null) => void;
  alAbrirCaso?: (caso: CasoRecepcion) => void;
  alVolver: () => void;
  alEditarCliente?: (cliente: ClienteTaller) => void;
  alEditarVehiculo?: (vehiculo: VehiculoTaller) => void;
}

export function DetalleCliente({
  clienteId,
  vehiculoAbiertoId: vehiculoRecordadoId,
  alCambiarVehiculoAbierto,
  alAbrirCaso,
  alVolver,
  alEditarCliente,
  alEditarVehiculo,
}: Propiedades) {
  const [cliente, establecerCliente] = useState<ClienteTaller | null>(null);
  const [vehiculos, establecerVehiculos] = useState<VehiculoTaller[]>([]);
  const [vehiculoAbiertoId, establecerVehiculoAbiertoId] = useState<
    string | null
  >(null);
  const [cargando, establecerCargando] = useState(true);
  const [actualizando, establecerActualizando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const numeroConsulta = useRef(0);
  const [revisionHistorial, establecerRevisionHistorial] = useState(0);
  const seleccionadoId =
    vehiculoRecordadoId === undefined ? vehiculoAbiertoId : vehiculoRecordadoId;

  const cargar = useCallback(
    async (esActualizacion = false) => {
      const consulta = ++numeroConsulta.current;
      establecerError(null);
      if (esActualizacion) establecerActualizando(true);
      else establecerCargando(true);
      try {
        // leo ambos registros en paralelo; no necesito un caso ni un escaneo para verlos
        const [encontrado, autos] = await Promise.all([
          obtenerCliente(clienteId),
          listarVehiculosCliente(clienteId),
        ]);
        if (consulta !== numeroConsulta.current) return;
        if (!encontrado) throw new Error('El cliente ya no está disponible.');
        establecerCliente(encontrado);
        establecerVehiculos(autos);
        establecerRevisionHistorial(actual => actual + 1);
        establecerVehiculoAbiertoId(actual =>
          autos.some(auto => auto.id === actual) ? actual : null,
        );
      } catch (capturado) {
        if (consulta === numeroConsulta.current)
          establecerError(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudieron cargar los registros.',
          );
      } finally {
        if (consulta === numeroConsulta.current) {
          establecerCargando(false);
          establecerActualizando(false);
        }
      }
    },
    [clienteId],
  );

  useEffect(() => {
    establecerCliente(null);
    establecerVehiculos([]);
    establecerVehiculoAbiertoId(null);
    cargar().catch(() => undefined);
    return () => {
      numeroConsulta.current += 1;
    };
  }, [cargar]);

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={() => cargar(true)}
          tintColor="#13C296"
        />
      }
    >
      <View style={estilos.cabecera}>
        <Pressable
          accessibilityLabel="Volver"
          accessibilityRole="button"
          onPress={alVolver}
          style={estilos.volver}
        >
          <Text style={estilos.flechaVolver}>‹</Text>
        </Pressable>
        <Text style={estilos.titulo}>Cliente</Text>
      </View>
      {cargando ? (
        <ActivityIndicator color="#13C296" style={estilos.cargando} />
      ) : error ? (
        <View style={estilos.mensaje}>
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => cargar()}
            style={estilos.reintentar}
          >
            <Text style={estilos.textoAccion}>Intentar nuevamente</Text>
          </Pressable>
        </View>
      ) : cliente ? (
        <>
          <View style={estilos.ficha}>
            <Text style={estilos.nombre}>{cliente.nombre}</Text>
            <Dato etiqueta="Teléfono" valor={cliente.telefono} />
            <Dato etiqueta="Correo" valor={cliente.correo} />
            {alEditarCliente ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => alEditarCliente(cliente)}
                style={estilos.reintentar}
              >
                <Text style={estilos.textoAccion}>Editar cliente</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={estilos.subtitulo}>Vehículos</Text>
          {vehiculos.length === 0 ? (
            <Text style={estilos.vacio}>Sin vehículos registrados.</Text>
          ) : (
            vehiculos.map(auto => (
              <FichaVehiculo
                key={auto.id}
                vehiculo={auto}
                abierta={seleccionadoId === auto.id}
                revisionHistorial={revisionHistorial}
                alAbrirCaso={alAbrirCaso}
                alEditar={
                  alEditarVehiculo ? () => alEditarVehiculo(auto) : undefined
                }
                alAlternar={() => {
                  const siguiente = seleccionadoId === auto.id ? null : auto.id;
                  establecerVehiculoAbiertoId(siguiente);
                  alCambiarVehiculoAbierto?.(siguiente);
                }}
              />
            ))
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function FichaVehiculo({
  vehiculo,
  abierta,
  alAlternar,
  revisionHistorial,
  alAbrirCaso,
  alEditar,
}: {
  vehiculo: VehiculoTaller;
  abierta: boolean;
  alAlternar: () => void;
  revisionHistorial: number;
  alAbrirCaso?: (caso: CasoRecepcion) => void;
  alEditar?: () => void;
}) {
  return (
    <View style={estilos.fichaVehiculo}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver datos de ${vehiculo.patente ?? 'vehículo'}`}
        accessibilityState={{ expanded: abierta }}
        onPress={alAlternar}
        style={({ pressed }) => [
          estilos.resumenVehiculo,
          pressed && estilos.presionada,
        ]}
      >
        <View style={estilos.resumenTexto}>
          <Text style={estilos.patente}>
            {vehiculo.patente ?? 'Sin patente'}
          </Text>
          <Text style={estilos.modelo}>
            {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') ||
              'Vehículo'}
          </Text>
        </View>
        <Text style={estilos.flecha}>{abierta ? '−' : '+'}</Text>
      </Pressable>
      {abierta ? (
        <View style={estilos.datosVehiculo}>
          <Dato etiqueta="Patente" valor={vehiculo.patente} />
          <Dato etiqueta="Marca" valor={vehiculo.marca} />
          <Dato etiqueta="Modelo" valor={vehiculo.modelo} />
          <Dato etiqueta="Año" valor={vehiculo.anio?.toString()} />
          <Dato
            etiqueta="Combustible"
            valor={
              vehiculo.combustible === 'gasolina'
                ? 'Gasolina'
                : vehiculo.combustible === 'diesel'
                ? 'Diesel'
                : vehiculo.combustible
            }
          />
          <Dato
            etiqueta="VIN"
            valor={vehiculo.vin}
            ausente="Sin VIN registrado"
          />
          <Dato etiqueta="Antecedentes" valor={vehiculo.antecedentesVehiculo} />
          {alEditar ? (
            <Pressable
              accessibilityRole="button"
              onPress={alEditar}
              style={estilos.reintentar}
            >
              <Text style={estilos.textoAccion}>Editar vehículo</Text>
            </Pressable>
          ) : null}
          <HistorialVehiculo
            vehiculoId={vehiculo.id}
            revision={revisionHistorial}
            alAbrirCaso={alAbrirCaso}
          />
        </View>
      ) : null}
    </View>
  );
}

function HistorialVehiculo({
  vehiculoId,
  revision,
  alAbrirCaso,
}: {
  vehiculoId: string;
  revision: number;
  alAbrirCaso?: (caso: CasoRecepcion) => void;
}) {
  const [casos, establecerCasos] = useState<CasoRecepcion[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState<string | null>(null);
  const [errorApertura, establecerErrorApertura] = useState<string | null>(
    null,
  );
  const [abriendoId, establecerAbriendoId] = useState<string | null>(null);
  const numeroConsulta = useRef(0);
  const numeroApertura = useRef(0);
  const aperturaEnCurso = useRef(false);

  const cargar = useCallback(async () => {
    const consulta = ++numeroConsulta.current;
    numeroApertura.current += 1;
    aperturaEnCurso.current = false;
    establecerAbriendoId(null);
    establecerCargando(true);
    establecerError(null);
    establecerErrorApertura(null);
    try {
      const resultado = await listarCasosVehiculo(vehiculoId);
      if (consulta === numeroConsulta.current) establecerCasos(resultado);
    } catch (capturado) {
      if (consulta === numeroConsulta.current)
        establecerError(
          capturado instanceof Error
            ? capturado.message
            : 'No se pudieron cargar los casos.',
        );
    } finally {
      if (consulta === numeroConsulta.current) establecerCargando(false);
    }
  }, [vehiculoId]);

  useEffect(() => {
    // consulto el historial solo cuando se despliega este auto
    cargar().catch(() => undefined);
    return () => {
      numeroConsulta.current += 1;
      numeroApertura.current += 1;
    };
  }, [cargar, revision]);

  async function abrir(caso: CasoRecepcion) {
    if (
      !alAbrirCaso ||
      aperturaEnCurso.current ||
      !tieneDiagnosticoIngresoPendiente(caso)
    )
      return;
    aperturaEnCurso.current = true;
    const apertura = ++numeroApertura.current;
    establecerAbriendoId(caso.id);
    establecerErrorApertura(null);
    try {
      // vuelvo a leerlo por si otro trabajador ya avanzo el caso
      const actual = await obtenerCasoRecepcion(caso.id);
      if (apertura !== numeroApertura.current) return;
      if (!actual || actual.vehiculoId !== vehiculoId) {
        establecerCasos(anteriores =>
          anteriores.filter(item => item.id !== caso.id),
        );
        throw new Error('El caso ya no está disponible para este vehículo.');
      }
      establecerCasos(anteriores =>
        anteriores.map(item => (item.id === actual.id ? actual : item)),
      );
      if (!tieneDiagnosticoIngresoPendiente(actual))
        throw new Error(
          'El caso ya no tiene un diagnóstico de ingreso pendiente.',
        );
      alAbrirCaso(actual);
    } catch (capturado) {
      if (apertura === numeroApertura.current)
        establecerErrorApertura(
          capturado instanceof Error
            ? capturado.message
            : 'No se pudo abrir el caso.',
        );
    } finally {
      if (apertura === numeroApertura.current) {
        aperturaEnCurso.current = false;
        establecerAbriendoId(null);
      }
    }
  }

  const nombresEstado: Record<EstadoCasoDiagnostico, string> = {
    ingresado: 'Ingresado',
    diagnostico_inicial: 'Diagnóstico inicial',
    asignado: 'Asignado',
    en_revision: 'En revisión',
    diagnosticado: 'Diagnosticado',
    cerrado: 'Cerrado',
  };
  return (
    <View style={estilos.historial}>
      <Text style={estilos.tituloHistorial}>Casos del vehículo</Text>
      {cargando ? (
        <ActivityIndicator color="#13C296" />
      ) : error ? (
        <>
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={cargar}
            style={estilos.reintentar}
          >
            <Text style={estilos.textoAccion}>Reintentar casos</Text>
          </Pressable>
        </>
      ) : casos.length === 0 ? (
        <Text style={estilos.vacio}>Sin casos registrados.</Text>
      ) : (
        casos.map(caso => (
          <View key={caso.id} style={estilos.caso}>
            <Text style={estilos.valor}>{caso.motivoIngreso}</Text>
            <View style={estilos.filaCaso}>
              <Text style={estilos.estadoCaso}>
                {nombresEstado[caso.estado]}
              </Text>
              <Text style={estilos.etiqueta}>
                {new Intl.DateTimeFormat('es-CL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                }).format(new Date(caso.creadoEn))}
              </Text>
            </View>
            <Text style={estilos.etiqueta}>
              {caso.snapshotIngreso
                ? `Escaneo de ingreso ${caso.snapshotIngreso.estado}`
                : 'Sin escaneo de ingreso'}
            </Text>
            {alAbrirCaso && tieneDiagnosticoIngresoPendiente(caso) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Abrir caso: ${caso.motivoIngreso}`}
                accessibilityState={{
                  disabled: abriendoId !== null,
                  busy: abriendoId === caso.id,
                }}
                disabled={abriendoId !== null}
                onPress={() => abrir(caso)}
                style={estilos.reintentar}
              >
                <Text style={estilos.textoAccion}>
                  {abriendoId === caso.id ? 'Abriendo…' : 'Abrir caso'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
      {errorApertura ? (
        <Text accessibilityRole="alert" style={estilos.error}>
          {errorApertura}
        </Text>
      ) : null}
    </View>
  );
}

function Dato({
  etiqueta,
  valor,
  ausente = 'Sin registrar',
}: {
  etiqueta: string;
  valor?: string | null;
  ausente?: string;
}) {
  return (
    <View style={estilos.dato}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text selectable style={estilos.valor}>
        {valor?.trim() || ausente}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
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
  cargando: { marginTop: 35 },
  ficha: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 16,
  },
  nombre: {
    color: '#F4F4F5',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitulo: {
    color: '#F4F4F5',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 26,
    marginBottom: 14,
  },
  dato: { marginTop: 13 },
  etiqueta: { color: '#85858C', fontSize: 11, marginBottom: 5 },
  valor: { color: '#E4E4E7', fontSize: 14, lineHeight: 21 },
  fichaVehiculo: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    marginBottom: 11,
    overflow: 'hidden',
  },
  resumenVehiculo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    minHeight: 72,
  },
  resumenTexto: { flex: 1 },
  patente: { color: '#5BE0BB', fontSize: 15, fontWeight: '700' },
  modelo: { color: '#C7C7CC', fontSize: 13, marginTop: 6 },
  flecha: { color: '#A1A1AA', fontSize: 24, marginLeft: 12 },
  datosVehiculo: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#303034',
    paddingHorizontal: 15,
    paddingBottom: 16,
  },
  presionada: { opacity: 0.75 },
  historial: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#303034',
  },
  tituloHistorial: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  caso: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#303034',
  },
  filaCaso: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  estadoCaso: { color: '#66DFBD', fontSize: 11 },
  vacio: { color: '#A1A1AA', fontSize: 13 },
  mensaje: { paddingVertical: 20, alignItems: 'center' },
  error: { color: '#FF9C94', fontSize: 12, textAlign: 'center' },
  reintentar: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  textoAccion: { color: '#5BE0BB', fontSize: 13, fontWeight: '700' },
});
