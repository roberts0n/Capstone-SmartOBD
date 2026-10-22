import { useEstilosTematicos } from '../tema/tokensTema';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  iniciarRevisionCaso,
  obtenerCasoMecanico,
  type CasoMecanico,
} from '../casos/ServicioCasosMecanico';
import { useProteccionSalida } from '../componentes/ProteccionSalida';
import { LecturasSnapshot } from '../componentes/LecturasSnapshot';
import {
  listarCatalogoPids,
  listarSnapshotsCaso,
  obtenerSnapshotDiagnostico,
} from '../diagnosticos/ServicioSnapshotsDiagnostico';
import type {
  CatalogoPid,
  SnapshotDiagnostico,
} from '../diagnosticos/TiposSnapshotDiagnostico';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  casoId: string;
  sesion: SesionTaller;
  alVolver: () => void;
  alAbrirMediciones?: () => void;
}

export function DetalleCasoMecanico({
  casoId,
  sesion,
  alVolver,
  alAbrirMediciones,
}: Propiedades) {
  const estilos = useEstilosTematicos(estilosBase);
  const [caso, establecerCaso] = useState<CasoMecanico | null>(null);
  const [snapshot, establecerSnapshot] = useState<SnapshotDiagnostico | null>(
    null,
  );
  const [catalogo, establecerCatalogo] = useState<CatalogoPid[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [guardando, establecerGuardando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const [errorSnapshot, establecerErrorSnapshot] = useState<string | null>(
    null,
  );
  const [aviso, establecerAviso] = useState<string | null>(null);
  const numeroConsulta = useRef(0);
  const operacionEnCurso = useRef(false);
  const solicitarSalida = useProteccionSalida({ ocupado: guardando });

  const cargar = useCallback(async () => {
    const numero = ++numeroConsulta.current;
    establecerCargando(true);
    establecerCaso(null);
    establecerSnapshot(null);
    establecerError(null);
    establecerErrorSnapshot(null);
    try {
      const actual = await obtenerCasoMecanico(casoId, sesion);
      if (numero !== numeroConsulta.current) return;
      if (!actual) {
        establecerError('Este caso ya no está disponible para tu cuenta.');
        return;
      }
      establecerCaso(actual);
      try {
        const resumenes = await listarSnapshotsCaso(casoId);
        if (numero !== numeroConsulta.current) return;
        const ingreso = resumenes.find(item => item.tipo === 'ingreso');
        if (!ingreso) return;
        const [captura, definiciones] = await Promise.all([
          obtenerSnapshotDiagnostico(ingreso.id),
          // si el catalogo no carga, sigo mostrando los codigos y valores guardados
          listarCatalogoPids().catch(() => [] as CatalogoPid[]),
        ]);
        if (numero !== numeroConsulta.current) return;
        if (
          !captura ||
          captura.casoId !== casoId ||
          captura.tallerId !== sesion.tallerId
        )
          throw new Error('No se pudo recuperar el escaneo inicial.');
        establecerSnapshot(captura);
        establecerCatalogo(definiciones);
      } catch {
        if (numero === numeroConsulta.current)
          establecerErrorSnapshot('No se pudo consultar el escaneo inicial.');
      }
    } catch (capturado) {
      if (numero === numeroConsulta.current)
        establecerError(
          capturado instanceof Error
            ? capturado.message
            : 'No se pudo recuperar el caso.',
        );
    } finally {
      if (numero === numeroConsulta.current) establecerCargando(false);
    }
  }, [casoId, sesion]);

  useEffect(() => {
    cargar().catch(() => undefined);
    return () => {
      numeroConsulta.current += 1;
    };
  }, [cargar]);

  async function comenzarRevision() {
    if (operacionEnCurso.current || cargando || caso?.estado !== 'asignado')
      return;
    operacionEnCurso.current = true;
    establecerGuardando(true);
    establecerAviso(null);
    const numero = numeroConsulta.current;
    try {
      await iniciarRevisionCaso(casoId, sesion);
      if (numero !== numeroConsulta.current) return;
      establecerAviso('Revisión iniciada.');
    } catch (capturado) {
      if (numero !== numeroConsulta.current) return;
      establecerAviso(
        capturado instanceof Error
          ? capturado.message
          : 'No se pudo confirmar el inicio de la revisión.',
      );
    }
    // vuelvo a leer incluso ante un fallo de red: la escritura pudo haberse completado
    if (numero === numeroConsulta.current) {
      const recarga = numeroConsulta.current + 1;
      await cargar();
      if (numeroConsulta.current === recarga) establecerGuardando(false);
    }
    operacionEnCurso.current = false;
  }

  return (
    <View style={estilos.pantalla}>
      <View style={estilos.cabecera}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a mis casos"
          style={estilos.volver}
          onPress={() => solicitarSalida(alVolver)}
        >
          <Text style={estilos.flecha}>‹</Text>
        </Pressable>
        <Text style={estilos.titulo}>Detalle del caso</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Actualizar caso"
          disabled={guardando || cargando}
          onPress={() => cargar()}
        >
          <Text
            style={[
              estilos.enlace,
              (guardando || cargando) && estilos.deshabilitado,
            ]}
          >
            Actualizar
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={estilos.contenido}>
        {aviso ? (
          <Text accessibilityRole="alert" style={estilos.aviso}>
            {aviso}
          </Text>
        ) : null}
        {cargando ? (
          <ActivityIndicator color="#287FFF" />
        ) : error ? (
          <View style={estilos.tarjeta}>
            <Text accessibilityRole="alert" style={estilos.error}>
              {error}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => cargar()}>
              <Text style={estilos.enlace}>Reintentar</Text>
            </Pressable>
          </View>
        ) : caso ? (
          <>
            <View style={estilos.tarjeta}>
              <View style={estilos.fila}>
                <Text style={estilos.subtitulo}>{caso.vehiculo}</Text>
                <Text style={estilos.estado}>{nombreEstado(caso.estado)}</Text>
              </View>
              <Text style={estilos.patente}>{caso.patente}</Text>
              <Dato etiqueta="Cliente" valor={caso.cliente} />
              <Dato etiqueta="VIN" valor={caso.vin ?? 'Sin VIN registrado'} />
              <Dato etiqueta="Prioridad" valor={caso.prioridad} />
              <Dato etiqueta="Caso" valor={caso.id.slice(0, 8)} />
            </View>
            <View style={estilos.tarjeta}>
              <Text style={estilos.subtitulo}>Ingreso</Text>
              <Dato etiqueta="Motivo" valor={caso.motivoIngreso} />
              <Dato
                etiqueta="Síntomas informados"
                valor={caso.sintomasInformados || 'Sin síntomas adicionales'}
              />
            </View>
            <View style={estilos.tarjeta}>
              <Text style={estilos.subtitulo}>Escaneo inicial</Text>
              {errorSnapshot ? (
                <>
                  <Text style={estilos.error}>{errorSnapshot}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => cargar()}
                  >
                    <Text style={estilos.enlace}>Reintentar consulta</Text>
                  </Pressable>
                </>
              ) : snapshot ? (
                <>
                  <Text style={estilos.valor}>
                    {snapshot.estado === 'completo' ? 'Completo' : 'Parcial'}
                  </Text>
                  {snapshot.motivoParcial ? (
                    <Text style={estilos.secundario}>
                      {motivoParcial(snapshot.motivoParcial)}
                    </Text>
                  ) : null}
                  <Text style={estilos.secundario}>
                    {snapshot.valoresPid.length} lecturas guardadas
                  </Text>
                  {snapshot.codigosDtc.length ? (
                    (['03', '07', '0A'] as const).map(modo => {
                      const codigos = [
                        ...new Set(
                          snapshot.codigosDtc
                            .filter(item => item.modoObd === modo)
                            .map(item => item.codigo),
                        ),
                      ];
                      return codigos.length ? (
                        <Dato
                          key={modo}
                          etiqueta={
                            modo === '03'
                              ? 'DTC confirmados'
                              : modo === '07'
                              ? 'DTC pendientes'
                              : 'DTC permanentes'
                          }
                          valor={codigos.join(', ')}
                        />
                      ) : null;
                    })
                  ) : (
                    <Text style={estilos.secundario}>
                      Sin códigos DTC registrados en esta captura.
                    </Text>
                  )}
                  <LecturasSnapshot
                    key={snapshot.id}
                    lecturas={snapshot.valoresPid}
                    catalogo={catalogo}
                  />
                </>
              ) : (
                <Text style={estilos.secundario}>
                  El caso no tiene un escaneo inicial guardado.
                </Text>
              )}
            </View>
            {caso.conclusionTecnica ? (
              <View style={estilos.tarjeta}>
                <Text style={estilos.subtitulo}>Conclusión técnica</Text>
                <Text style={estilos.valor}>{caso.conclusionTecnica}</Text>
              </View>
            ) : null}
            {caso.estado === 'asignado' ? (
              <Pressable
                accessibilityRole="button"
                disabled={guardando}
                onPress={comenzarRevision}
                style={[estilos.boton, guardando && estilos.deshabilitado]}
              >
                <Text style={estilos.textoBoton}>
                  {guardando ? 'Iniciando revisión...' : 'Comenzar revisión'}
                </Text>
              </Pressable>
            ) : null}
            {alAbrirMediciones ? (
              <Pressable
                accessibilityRole="button"
                disabled={guardando}
                onPress={() => solicitarSalida(alAbrirMediciones)}
                style={[estilos.boton, guardando && estilos.deshabilitado]}
              >
                <Text style={estilos.textoBoton}>Mediciones</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const estilos = useEstilosTematicos(estilosBase);
  return (
    <View style={estilos.dato}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text selectable style={estilos.valor}>
        {valor}
      </Text>
    </View>
  );
}

function nombreEstado(estado: CasoMecanico['estado']) {
  const nombres = {
    ingresado: 'Ingresado',
    diagnostico_inicial: 'Diagnóstico inicial',
    asignado: 'Pendiente',
    en_revision: 'En revisión',
    diagnosticado: 'Diagnosticado',
    cerrado: 'Cerrado',
  };
  return nombres[estado];
}

function motivoParcial(
  motivo: NonNullable<SnapshotDiagnostico['motivoParcial']>,
) {
  return {
    motor_no_arranca: 'El motor no arrancaba al escanear.',
    lecturas_incompletas: 'Quedaron lecturas incompletas.',
    conexion_interrumpida: 'La conexión se interrumpió durante el escaneo.',
    otro: 'La captura quedó incompleta.',
  }[motivo];
}

const estilosBase = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  volver: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#202023',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flecha: { color: '#F4F4F5', fontSize: 30, lineHeight: 32 },
  titulo: { flex: 1, color: '#F4F4F5', fontSize: 19, fontWeight: '700' },
  contenido: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  tarjeta: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 17,
    gap: 12,
  },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  subtitulo: {
    flexShrink: 1,
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '700',
  },
  estado: { color: '#66DFBD', fontSize: 12 },
  patente: { color: '#13C296', fontSize: 15, fontWeight: '700' },
  dato: { gap: 5 },
  etiqueta: { color: '#96969D', fontSize: 12 },
  valor: { color: '#E6E6EA', fontSize: 14, lineHeight: 21 },
  secundario: { color: '#96969D', fontSize: 13, lineHeight: 20 },
  error: { color: '#FF9C94', fontSize: 13 },
  aviso: { color: '#B0E6D7', fontSize: 13, lineHeight: 20 },
  enlace: {
    color: '#4DDBB7',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 9,
  },
  boton: {
    borderRadius: 12,
    backgroundColor: '#10A37F',
    alignItems: 'center',
    padding: 16,
  },
  textoBoton: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  deshabilitado: { opacity: 0.4 },
});
