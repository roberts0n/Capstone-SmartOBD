import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CasoRecepcion } from '../casos/ServicioCasosRecepcion';
import type { EstadoCasoDiagnostico } from '../casos/TiposCasoDiagnostico';
import { useCapturaSnapshot } from '../diagnosticos/usarCapturaSnapshot';
import {
  listarSnapshotsCaso,
  obtenerSnapshotDiagnostico,
} from '../diagnosticos/ServicioSnapshotsDiagnostico';
import type { CondicionMotorSnapshot } from '../diagnosticos/TiposCapturaSnapshot';
import type { SnapshotDiagnostico } from '../diagnosticos/TiposSnapshotDiagnostico';
import { useSesionEscanerObd } from '../escaner/ContextoEscanerObd';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  caso: CasoRecepcion;
  sesion: SesionTaller;
  alVolver: () => void;
  alAbrirEscaner: () => void;
  alActualizarCaso: (caso: CasoRecepcion) => void;
}

export function DetalleCasoRecepcion({
  caso,
  sesion,
  alVolver,
  alAbrirEscaner,
  alActualizarCaso,
}: Propiedades) {
  const sesionEscaner = useSesionEscanerObd();
  const captura = useCapturaSnapshot();
  const [confirmando, establecerConfirmando] = useState(false);
  const [consultando, establecerConsultando] = useState(true);
  const [snapshotIngreso, establecerSnapshotIngreso] =
    useState<SnapshotDiagnostico | null>(null);
  const [errorConsulta, establecerErrorConsulta] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    async function consultarSnapshot() {
      establecerConsultando(true);
      establecerErrorConsulta(null);
      try {
        const resumenes = await listarSnapshotsCaso(caso.id);
        const ingreso = resumenes.find(item => item.tipo === 'ingreso');
        const detalle = ingreso
          ? await obtenerSnapshotDiagnostico(ingreso.id)
          : null;
        if (activo) establecerSnapshotIngreso(detalle);
      } catch (capturado) {
        if (activo) establecerErrorConsulta(mensajeError(capturado));
      } finally {
        if (activo) establecerConsultando(false);
      }
    }

    consultarSnapshot().catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [caso.id]);

  const escanerListo =
    sesionEscaner.conectado() &&
    Boolean(sesionEscaner.escrituraSeleccionada) &&
    Boolean(sesionEscaner.notificacionSeleccionada);

  async function comenzar(condicionMotor: CondicionMotorSnapshot) {
    const resultado = await captura.iniciar({
      casoId: caso.id,
      vehiculoId: caso.vehiculoId,
      tipo: 'ingreso',
      condicionMotor,
      sesionTaller: sesion,
    });
    if (!resultado) return;

    establecerSnapshotIngreso(resultado.snapshotGuardado);
    establecerConfirmando(false);
    alActualizarCaso({
      ...caso,
      vin: resultado.vinLeido ?? caso.vin,
      estado: 'diagnostico_inicial',
    });
  }

  const puedeCapturar = caso.estado === 'ingresado' && !snapshotIngreso;
  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
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
        <View style={estilos.textosCabecera}>
          <Text style={estilos.titulo}>Caso {codigoCaso(caso.id)}</Text>
          <Text style={estilos.estado}>{nombreEstado(caso.estado)}</Text>
        </View>
      </View>

      <View style={estilos.bloque}>
        <Dato etiqueta="Cliente" valor={caso.cliente} />
        <Dato etiqueta="Vehículo" valor={caso.vehiculo} />
        <Dato etiqueta="Patente" valor={caso.patente} />
        <Dato etiqueta="VIN" valor={caso.vin ?? 'Pendiente de lectura'} />
        <Dato
          etiqueta="Mecánico"
          valor={caso.mecanico ?? 'Sin mecánico asignado'}
        />
      </View>

      <Text style={estilos.etiquetaMotivo}>Motivo de ingreso</Text>
      <Text style={estilos.motivo}>{caso.motivoIngreso}</Text>

      <View style={estilos.seccionDiagnostico}>
        <Text style={estilos.tituloSeccion}>Escaneo inicial</Text>

        {consultando ? (
          <ActivityIndicator color="#10A37F" style={estilos.cargando} />
        ) : snapshotIngreso ? (
          <ResumenSnapshot snapshot={snapshotIngreso} />
        ) : (
          <>
            <Text style={estilos.textoSecundario}>
              {escanerListo
                ? 'Escáner conectado y listo.'
                : 'Conecta y verifica el escáner para comenzar.'}
            </Text>

            {!escanerListo ? (
              <Boton etiqueta="Conectar escáner" alPresionar={alAbrirEscaner} />
            ) : puedeCapturar && !confirmando ? (
              <Boton
                etiqueta="Preparar escaneo inicial"
                alPresionar={() => establecerConfirmando(true)}
              />
            ) : puedeCapturar && confirmando ? (
              <View style={estilos.confirmacion}>
                <Text style={estilos.textoConfirmacion}>
                  Mantén el vehículo detenido, ventilado y con el freno aplicado.
                </Text>
                <Boton
                  etiqueta="Motor en marcha: verificar y comenzar"
                  alPresionar={() => comenzar('en_marcha')}
                  deshabilitado={captura.enCurso}
                />
                <Boton
                  etiqueta="El motor no arranca: captura parcial"
                  alPresionar={() => comenzar('no_arranca')}
                  deshabilitado={captura.enCurso}
                  secundario
                />
              </View>
            ) : (
              <Text style={estilos.textoSecundario}>
                Este caso ya avanzó y no admite otro escaneo de ingreso.
              </Text>
            )}
          </>
        )}

        {captura.enCurso && captura.progreso ? (
          <View style={estilos.progreso}>
            <ActivityIndicator color="#10A37F" />
            <Text style={estilos.textoProgreso}>{captura.progreso.mensaje}</Text>
            <Pressable onPress={captura.cancelar}>
              <Text style={estilos.cancelar}>Cancelar</Text>
            </Pressable>
          </View>
        ) : null}
        {captura.error ? <Text style={estilos.error}>{captura.error}</Text> : null}
        {errorConsulta ? <Text style={estilos.error}>{errorConsulta}</Text> : null}
        {captura.resultado?.advertencias?.map(advertencia => (
          <Text key={advertencia} style={estilos.advertencia}>
            {advertencia}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

function ResumenSnapshot({ snapshot }: { snapshot: SnapshotDiagnostico }) {
  return (
    <View style={estilos.resumen}>
      <Text style={estilos.resultadoPrincipal}>
        {snapshot.estado === 'completo' ? 'Escaneo completo' : 'Escaneo parcial'}
      </Text>
      <Text style={estilos.textoSecundario}>
        {snapshot.valoresPid.length} lecturas · {snapshot.codigosDtc.length} DTC
      </Text>
      {snapshot.motivoParcial ? (
        <Text style={estilos.advertencia}>
          Motivo: {nombreMotivoParcial(snapshot.motivoParcial)}
        </Text>
      ) : null}
    </View>
  );
}

function Boton({
  etiqueta,
  alPresionar,
  deshabilitado = false,
  secundario = false,
}: {
  etiqueta: string;
  alPresionar: () => void;
  deshabilitado?: boolean;
  secundario?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={deshabilitado}
      onPress={alPresionar}
      style={[
        estilos.boton,
        secundario && estilos.botonSecundario,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      <Text style={estilos.textoBoton}>{etiqueta}</Text>
    </Pressable>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.dato}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text style={estilos.valor}>{valor}</Text>
    </View>
  );
}

function codigoCaso(id: string): string {
  return `OT-${id.slice(0, 8).toUpperCase()}`;
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

function nombreMotivoParcial(motivo: SnapshotDiagnostico['motivoParcial']) {
  if (motivo === 'motor_no_arranca') return 'el motor no arranca';
  if (motivo === 'conexion_interrumpida') return 'conexión interrumpida';
  if (motivo === 'lecturas_incompletas') return 'lecturas incompletas';
  return 'otro';
}

function mensajeError(capturado: unknown): string {
  return capturado instanceof Error ? capturado.message : String(capturado);
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  textosCabecera: { flex: 1 },
  titulo: { color: '#F4F4F5', fontSize: 21, fontWeight: '700' },
  estado: { color: '#66DFBD', fontSize: 11, fontWeight: '700', marginTop: 4 },
  bloque: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginTop: 24,
  },
  dato: {
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#303034',
  },
  etiqueta: { color: '#85858C', fontSize: 10, fontWeight: '700' },
  valor: { color: '#F0F0F2', fontSize: 14, marginTop: 5 },
  etiquetaMotivo: {
    color: '#85858C',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 24,
  },
  motivo: { color: '#D4D4D8', fontSize: 14, lineHeight: 21, marginTop: 8 },
  seccionDiagnostico: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 15,
    marginTop: 24,
  },
  tituloSeccion: { color: '#F4F4F5', fontSize: 16, fontWeight: '700' },
  textoSecundario: {
    color: '#929299',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  cargando: { marginVertical: 22 },
  confirmacion: { marginTop: 12 },
  textoConfirmacion: {
    color: '#D4D4D8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  boton: {
    minHeight: 45,
    backgroundColor: '#10A37F',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    marginTop: 12,
  },
  botonSecundario: { backgroundColor: '#303034' },
  deshabilitado: { opacity: 0.45 },
  textoBoton: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  progreso: { alignItems: 'center', gap: 8, marginTop: 18 },
  textoProgreso: { color: '#D4D4D8', fontSize: 12, textAlign: 'center' },
  cancelar: { color: '#FF817A', fontSize: 12, fontWeight: '700' },
  error: { color: '#FF817A', fontSize: 12, lineHeight: 18, marginTop: 12 },
  advertencia: { color: '#E6B85C', fontSize: 12, lineHeight: 18, marginTop: 8 },
  resumen: { marginTop: 12 },
  resultadoPrincipal: { color: '#66DFBD', fontSize: 14, fontWeight: '700' },
});

export default DetalleCasoRecepcion;
