import { crearEstilosTematicos } from '../tema/tokensTema';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMedicionesCaso } from '../diagnosticos/usarMedicionesCaso';
import {
  GraficosRegistroPids,
  PanelGraficoPids,
  PanelRegistroHistoricoPids,
} from '../componentes/PanelGraficoPids';
import { useProteccionSalida } from '../componentes/ProteccionSalida';
import { formatearTiempoGrafico } from '../componentes/GraficoPid';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  casoId: string;
  sesion: SesionTaller;
  visible: boolean;
  alVolver: () => void;
  alConectar: () => void;
}
type Vista = 'vivo' | 'historico' | 'guardados';

export function MedicionesCaso({
  casoId,
  sesion,
  visible,
  alVolver,
  alConectar,
}: Propiedades) {
  const mediciones = useMedicionesCaso(casoId, sesion, visible);
  const [vista, establecerVista] = useState<Vista>('vivo');
  const [titulo, establecerTitulo] = useState('');
  const confirmando = useRef(false);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const ocupado = !!mediciones.operacion;
  const salir = useProteccionSalida({
    activa: visible,
    ocupado,
    cambios: mediciones.sinGuardar,
    cancelar:
      ocupado && !mediciones.operacion?.startsWith('Guardando')
        ? mediciones.detener
        : undefined,
    mensajeCambios:
      'El registro histórico todavía no se ha guardado en el caso. Si sales, se perderá.',
  });
  const registro = mediciones.registroAbierto;
  const seriesGuardadas = useMemo(
    () =>
      registro?.series.map(serie => ({
        comando: serie.pidCodigo,
        nombre: serie.nombre,
        unidad: serie.unidad,
        muestras: serie.muestras.map(muestra => ({
          comando: serie.pidCodigo,
          tiempoTranscurridoMs: muestra.tiempoMs,
          valor: muestra.valor,
          unidad: serie.unidad,
          error: null,
        })),
      })) ?? [],
    [registro],
  );

  function iniciarHistorico(comandos: readonly string[], duracion: number) {
    if (mediciones.estaOcupado() || confirmando.current) return;
    const comenzar = () => {
      if (!montado.current || mediciones.estaOcupado()) return;
      establecerTitulo('');
      mediciones.iniciar('historico', comandos, duracion);
    };
    if (!mediciones.sinGuardar) {
      comenzar();
      return;
    }
    confirmando.current = true;
    Alert.alert(
      'Registro sin guardar',
      'El nuevo registro reemplazará la captura que todavía no has guardado.',
      [
        {
          text: 'Conservar',
          style: 'cancel',
          onPress: () => {
            confirmando.current = false;
          },
        },
        {
          text: 'Reemplazar',
          style: 'destructive',
          onPress: () => {
            confirmando.current = false;
            comenzar();
          },
        },
      ],
      { cancelable: false },
    );
  }

  function cambiarVista(siguiente: Vista) {
    if (mediciones.estaOcupado()) return;
    establecerVista(siguiente);
    if (siguiente === 'guardados') mediciones.cargarRegistros();
  }

  if (!visible) return null;
  return (
    <View style={estilos.pantalla}>
      <View style={estilos.cabecera}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver al caso"
          onPress={() => salir(alVolver)}
          style={estilos.volver}
        >
          <Text style={estilos.flecha}>‹</Text>
        </Pressable>
        <Text style={estilos.titulo}>Mediciones</Text>
      </View>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        {mediciones.cargando ? <ActivityIndicator color="#287FFF" /> : null}
        {mediciones.caso ? (
          <>
            <View style={estilos.tarjeta}>
              <Text style={estilos.nombre}>{mediciones.caso.vehiculo}</Text>
              <Text style={estilos.patente}>{mediciones.caso.patente}</Text>
              <Text style={estilos.secundario}>Caso {casoId.slice(0, 8)}</Text>
            </View>
            <View style={estilos.pestanas}>
              {(['vivo', 'historico', 'guardados'] as const).map(item => (
                <Pressable
                  key={item}
                  accessibilityRole="tab"
                  accessibilityState={{
                    selected: vista === item,
                    disabled: ocupado,
                  }}
                  disabled={ocupado}
                  onPress={() => cambiarVista(item)}
                  style={[
                    estilos.pestana,
                    vista === item && estilos.seleccionada,
                    ocupado && estilos.deshabilitado,
                  ]}
                >
                  <Text style={estilos.texto}>
                    {
                      {
                        vivo: 'En vivo',
                        historico: 'Histórico',
                        guardados: 'Guardados',
                      }[item]
                    }
                  </Text>
                </Pressable>
              ))}
            </View>
            {vista !== 'guardados' ? (
              <>
                {mediciones.caso.estado !== 'en_revision' ? (
                  <Text style={estilos.secundario}>
                    Comienza la revisión desde el detalle del caso para realizar
                    mediciones nuevas.
                  </Text>
                ) : (
                  <>
                    {!mediciones.preparado ? (
                      <View style={estilos.tarjeta}>
                        {mediciones.operacion ? (
                          <Text style={estilos.secundario}>
                            {mediciones.operacion}
                          </Text>
                        ) : mediciones.pendiente ? (
                          <>
                            <Text style={estilos.texto}>
                              No se pudo contrastar el VIN. Confirma que el
                              escáner está conectado al vehículo{' '}
                              {mediciones.caso.patente}.
                            </Text>
                            <Boton
                              titulo="Confirmar vehículo"
                              alPulsar={mediciones.confirmarVehiculo}
                            />
                          </>
                        ) : (
                          <>
                            <Boton
                              titulo={
                                mediciones.conectado
                                  ? 'Preparar mediciones'
                                  : 'Conectar escáner'
                              }
                              alPulsar={() =>
                                mediciones.conectado
                                  ? mediciones.preparar()
                                  : alConectar()
                              }
                            />
                            {mediciones.conectado ? (
                              <Boton
                                secundario
                                titulo="Reconectar escáner"
                                alPulsar={alConectar}
                              />
                            ) : null}
                          </>
                        )}
                      </View>
                    ) : null}
                  </>
                )}
                {mediciones.error ? (
                  <Text accessibilityRole="alert" style={estilos.error}>
                    {mediciones.error}
                  </Text>
                ) : null}
                {ocupado &&
                mediciones.preparado &&
                !mediciones.vivo.enCurso &&
                !mediciones.historico.enCurso ? (
                  <Text style={estilos.secundario}>{mediciones.operacion}</Text>
                ) : null}
                {vista === 'vivo' ? (
                  <PanelGraficoPids
                    usoTaller
                    pidsCompatibles={mediciones.pids}
                    comandoActivo={mediciones.vivo.comando}
                    muestras={mediciones.vivo.muestras}
                    enCurso={mediciones.vivo.enCurso}
                    deteniendo={mediciones.vivo.deteniendo}
                    frecuenciaHz={mediciones.vivo.frecuenciaHz}
                    deshabilitado={
                      ocupado ||
                      !mediciones.preparado ||
                      mediciones.caso.estado !== 'en_revision'
                    }
                    error={mediciones.vivo.error}
                    mensaje={mediciones.vivo.mensaje}
                    alIniciar={comando => mediciones.iniciar('vivo', [comando])}
                    alDetener={mediciones.detener}
                    alLimpiar={mediciones.vivo.limpiar}
                  />
                ) : (
                  <>
                    <PanelRegistroHistoricoPids
                      usoTaller
                      pidsCompatibles={mediciones.pids}
                      enCurso={mediciones.historico.enCurso}
                      estado={mediciones.historico.estado}
                      restanteMs={mediciones.historico.restanteMs}
                      deshabilitado={
                        ocupado ||
                        !mediciones.preparado ||
                        mediciones.caso.estado !== 'en_revision'
                      }
                      ocupado={ocupado}
                      registro={mediciones.historico.registro}
                      error={mediciones.historico.error}
                      mensajeGuardado={null}
                      alIniciar={iniciarHistorico}
                      alDetener={mediciones.detener}
                      alGuardar={() => undefined}
                    />
                    {mediciones.historico.registro?.fin ? (
                      <View style={estilos.tarjeta}>
                        {mediciones.sinGuardar ? (
                          <>
                            <TextInput
                              accessibilityLabel="Título del registro"
                              placeholder="Título (opcional)"
                              placeholderTextColor="#88888F"
                              value={titulo}
                              onChangeText={establecerTitulo}
                              maxLength={100}
                              editable={!ocupado && !mediciones.tituloFijado}
                              style={estilos.entrada}
                            />
                            <Boton
                              titulo={
                                mediciones.operacion?.startsWith('Guardando')
                                  ? 'Guardando…'
                                  : 'Guardar en el caso'
                              }
                              deshabilitado={ocupado}
                              alPulsar={() => mediciones.guardar(titulo)}
                            />
                          </>
                        ) : !mediciones.guardado ? (
                          <Text style={estilos.secundario}>
                            No hay muestras válidas para guardar.
                          </Text>
                        ) : null}
                        {mediciones.avisoGuardado ? (
                          <Text accessibilityRole="alert" style={estilos.texto}>
                            {mediciones.avisoGuardado}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <>
                {mediciones.cargandoRegistros ? (
                  <ActivityIndicator color="#287FFF" />
                ) : null}
                {mediciones.errorRegistros ? (
                  <Text accessibilityRole="alert" style={estilos.error}>
                    {mediciones.errorRegistros}
                  </Text>
                ) : null}
                {registro ? (
                  <View style={estilos.tarjeta}>
                    <Boton
                      secundario
                      titulo="Volver a guardados"
                      alPulsar={mediciones.cerrarRegistro}
                    />
                    <Text style={estilos.nombre}>
                      {registro.titulo ?? 'Registro histórico'}
                    </Text>
                    <Text style={estilos.secundario}>
                      {new Date(registro.inicio).toLocaleString('es-CL')} ·{' '}
                      {registro.estado === 'completo' ? 'Completo' : 'Parcial'}{' '}
                      · {formatearTiempoGrafico(registro.duracionRealMs)}
                    </Text>
                    <Text style={estilos.secundario}>{registro.motivoFin}</Text>
                    <GraficosRegistroPids
                      series={seriesGuardadas}
                      duracionMs={registro.duracionRealMs}
                    />
                  </View>
                ) : (
                  <>
                    <Boton
                      secundario
                      titulo="Actualizar guardados"
                      deshabilitado={mediciones.cargandoRegistros}
                      alPulsar={() =>
                        mediciones.cargarRegistros(mediciones.pagina)
                      }
                    />
                    {!mediciones.cargandoRegistros &&
                    !mediciones.errorRegistros &&
                    !mediciones.registros.length ? (
                      <Text style={estilos.secundario}>
                        Todavía no hay registros guardados en este caso.
                      </Text>
                    ) : null}
                    {mediciones.registros.map(item => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        disabled={mediciones.cargandoRegistros}
                        onPress={() => mediciones.abrirRegistro(item.id)}
                        style={estilos.tarjeta}
                      >
                        <Text style={estilos.nombre}>
                          {item.titulo ?? 'Registro histórico'}
                        </Text>
                        <Text style={estilos.secundario}>
                          {new Date(item.inicio).toLocaleString('es-CL')} ·{' '}
                          {item.estado === 'completo' ? 'Completo' : 'Parcial'}{' '}
                          · {formatearTiempoGrafico(item.duracionRealMs)}
                        </Text>
                      </Pressable>
                    ))}
                    <View style={estilos.pestanas}>
                      {mediciones.pagina > 0 ? (
                        <Boton
                          secundario
                          titulo="Anteriores"
                          deshabilitado={mediciones.cargandoRegistros}
                          alPulsar={() =>
                            mediciones.cargarRegistros(mediciones.pagina - 1)
                          }
                        />
                      ) : null}
                      {mediciones.hayMas ? (
                        <Boton
                          secundario
                          titulo="Siguientes"
                          deshabilitado={mediciones.cargandoRegistros}
                          alPulsar={() =>
                            mediciones.cargarRegistros(mediciones.pagina + 1)
                          }
                        />
                      ) : null}
                    </View>
                  </>
                )}
              </>
            )}
          </>
        ) : !mediciones.cargando ? (
          <>
            <Text accessibilityRole="alert" style={estilos.error}>
              {mediciones.error ?? 'El caso no está disponible.'}
            </Text>
            <Boton
              titulo="Reintentar consulta"
              alPulsar={() => mediciones.actualizarCaso()}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Boton({
  titulo,
  alPulsar,
  deshabilitado,
  secundario,
}: {
  titulo: string;
  alPulsar: () => void;
  deshabilitado?: boolean;
  secundario?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={deshabilitado}
      onPress={alPulsar}
      style={[
        estilos.boton,
        secundario && estilos.secundarioBoton,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      <Text style={estilos.textoBoton}>{titulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create(crearEstilosTematicos({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
  },
  titulo: { color: '#F4F4F5', fontSize: 19, fontWeight: '700' },
  volver: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#202023',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flecha: { color: '#F4F4F5', fontSize: 30, lineHeight: 32 },
  contenido: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  tarjeta: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 17,
    gap: 12,
  },
  nombre: { color: '#F4F4F5', fontSize: 16, fontWeight: '700' },
  patente: { color: '#13C296', fontSize: 15, fontWeight: '700' },
  texto: { color: '#E6E6EA', fontSize: 13, lineHeight: 20 },
  secundario: { color: '#96969D', fontSize: 13, lineHeight: 20 },
  error: { color: '#FF9C94', fontSize: 13, lineHeight: 20 },
  pestanas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pestana: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38383D',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  seleccionada: { backgroundColor: '#11241F', borderColor: '#10A37F' },
  boton: {
    borderRadius: 12,
    backgroundColor: '#10A37F',
    alignItems: 'center',
    padding: 14,
  },
  secundarioBoton: {
    backgroundColor: '#202023',
    borderWidth: 1,
    borderColor: '#38383D',
  },
  textoBoton: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  entrada: {
    color: '#F4F4F5',
    backgroundColor: '#0D0D0E',
    borderWidth: 1,
    borderColor: '#38383D',
    borderRadius: 10,
    padding: 12,
  },
  deshabilitado: { opacity: 0.4 },
}));
