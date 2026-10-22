import { useEstilosTematicos } from '../tema/tokensTema';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  GraficoPid,
  GraficoHistoricoAmpliado,
  formatearTiempoGrafico,
} from './GraficoPid';
import {
  obtenerMedicionesGraficables,
  obtenerMedicionGraficaPid,
  type MedicionGraficaPid,
} from '../obd/CatalogoPidsMode01';
import { type MuestraPid, type InformeMuestreoPid } from '../obd/MuestreoPids';
import {
  DURACIONES_REGISTRO_MS,
  type RegistroHistoricoPids,
} from '../obd/RegistroHistoricoPids';

interface Propiedades {
  pidsCompatibles: readonly string[] | null;
  comandoActivo: string | null;
  muestras: readonly MuestraPid[];
  enCurso: boolean;
  deteniendo: boolean;
  deshabilitado: boolean;
  frecuenciaHz: number | null;
  error: string | null;
  mensaje: string | null;
  alIniciar: (comando: string) => void;
  alDetener: () => void;
  alLimpiar: () => void;
  informe?: InformeMuestreoPid | null;
  capturaOcupada?: boolean;
  mensajeCaptura?: string | null;
  alGuardarCaptura?: () => void;
  usoTaller?: boolean;
}
const MUESTRAS_VACIAS: readonly MuestraPid[] = [];

// comparto el selector; solo cambia si elegimos una medicion o hasta tres
const SelectorMediciones = memo(function OpcionesMediciones({
  disponibles,
  seleccionados,
  multiple,
  deshabilitado,
  alSeleccionar,
  usoTaller,
}: {
  disponibles: readonly MedicionGraficaPid[];
  seleccionados: readonly string[];
  multiple: boolean;
  deshabilitado: boolean;
  alSeleccionar: (comando: string) => void;
  usoTaller?: boolean;
}) {
  const estilos = useEstilosTematicos(estilosBase);
  const grupos = useMemo(() => {
    const agrupadas = new Map<string, MedicionGraficaPid[]>();
    for (const medicion of disponibles) {
      const grupo = agrupadas.get(medicion.categoria) ?? [];
      grupo.push(medicion);
      agrupadas.set(medicion.categoria, grupo);
    }
    return [...agrupadas.entries()];
  }, [disponibles]);
  const [categoriaAbierta, establecerCategoriaAbierta] = useState<
    string | null
  >(disponibles[0]?.categoria ?? null);
  useEffect(() => {
    if (
      categoriaAbierta !== null &&
      !grupos.some(([categoria]) => categoria === categoriaAbierta)
    )
      establecerCategoriaAbierta(grupos[0]?.[0] ?? null);
  }, [grupos, categoriaAbierta]);
  return (
    <View>
      {grupos.map(([categoria, mediciones]) => {
        const abierta = categoriaAbierta === categoria;
        const elegidas = mediciones.filter(item =>
          seleccionados.includes(item.comando),
        ).length;
        return (
          <View key={categoria} style={estilos.grupo}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Categoría ${categoria}`}
              accessibilityState={{ expanded: abierta }}
              onPress={() =>
                establecerCategoriaAbierta(abierta ? null : categoria)
              }
              style={estilos.categoria}
            >
              <Text style={estilos.textoOpcion}>
                {categoria} · {mediciones.length}
              </Text>
              <Text style={estilos.secundario}>
                {elegidas ? `${elegidas} ✓ ` : ''}
                {abierta ? '−' : '+'}
              </Text>
            </Pressable>
            {abierta ? (
              <View style={estilos.opciones}>
                {mediciones.map(medicion => {
                  const seleccionada = seleccionados.includes(medicion.comando);
                  const bloquear =
                    deshabilitado ||
                    (multiple && !seleccionada && seleccionados.length >= 3);
                  return (
                    <Pressable
                      key={medicion.comando}
                      accessibilityRole={multiple ? 'checkbox' : 'radio'}
                      accessibilityLabel={`${
                        multiple ? 'Registrar' : 'Graficar'
                      } ${medicion.comando}`}
                      accessibilityState={{
                        checked: seleccionada,
                        disabled: bloquear,
                      }}
                      disabled={bloquear}
                      onPress={() => {
                        if (!bloquear) alSeleccionar(medicion.comando);
                      }}
                      style={[
                        estilos.opcion,
                        seleccionada && estilos.seleccionada,
                        bloquear && estilos.deshabilitado,
                      ]}
                    >
                      <Text style={estilos.textoOpcion}>
                        {medicion.nombre}
                        {usoTaller ? '' : ` · ${medicion.comando}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
});

export function PanelGraficoPids(props: Propiedades) {
  const estilos = useEstilosTematicos(estilosBase);
  const disponibles = useMemo(
    () => obtenerMedicionesGraficables(props.pidsCompatibles),
    [props.pidsCompatibles],
  );
  const [seleccionado, establecerSeleccionado] = useState<string | null>(null);
  const [mostrarCaptura, establecerMostrarCaptura] = useState(false);
  const primero = disponibles[0]?.comando ?? null;
  const seleccionDisponible =
    seleccionado !== null &&
    disponibles.some(item => item.comando === seleccionado);
  useEffect(() => {
    if (!seleccionDisponible && !props.enCurso) establecerSeleccionado(primero);
  }, [seleccionDisponible, primero, props.enCurso]);
  const seleccionados = useMemo(
    () => (seleccionado ? [seleccionado] : []),
    [seleccionado],
  );
  const alLimpiar = props.alLimpiar;
  const seleccionar = useCallback(
    (comando: string) => {
      if (comando !== seleccionado) {
        alLimpiar();
        establecerSeleccionado(comando);
      }
    },
    [seleccionado, alLimpiar],
  );
  const medicion = seleccionado
    ? obtenerMedicionGraficaPid(seleccionado)
    : null;
  const muestras =
    props.comandoActivo === seleccionado ? props.muestras : MUESTRAS_VACIAS;
  const ultima = muestras[muestras.length - 1];
  const ultimaCaptura =
    props.informe?.capturas[props.informe.capturas.length - 1];
  if (
    props.usoTaller &&
    props.pidsCompatibles === null &&
    !muestras.length &&
    !props.enCurso
  )
    return null;
  return (
    <View style={estilos.panel}>
      <Text style={estilos.titulo}>Lectura en vivo</Text>
      {props.pidsCompatibles === null ? (
        <Text style={estilos.secundario}>
          Detecta los PID compatibles para elegir una medición.
        </Text>
      ) : disponibles.length === 0 ? (
        <Text style={estilos.secundario}>
          No se detectaron mediciones compatibles para graficar.
        </Text>
      ) : (
        <SelectorMediciones
          disponibles={disponibles}
          seleccionados={seleccionados}
          multiple={false}
          deshabilitado={props.enCurso || props.deshabilitado}
          alSeleccionar={seleccionar}
          usoTaller={props.usoTaller}
        />
      )}
      <View style={estilos.cabeceraValor}>
        {medicion ? (
          <Text style={estilos.textoOpcion}>{medicion.nombre}</Text>
        ) : null}
        <Text accessibilityLabel="Valor en vivo" style={estilos.valor}>
          {ultima?.valor == null
            ? '—'
            : ultima.valor.toLocaleString('es-CL', {
                maximumFractionDigits: 2,
              })}
          <Text style={estilos.unidad}>
            {' '}
            {ultima?.unidad ?? medicion?.unidad ?? ''}
          </Text>
        </Text>
        <Text style={estilos.secundario}>
          {muestras.length && props.frecuenciaHz !== null
            ? `${props.frecuenciaHz.toFixed(2)} lecturas/s`
            : 'Sin frecuencia medida'}
        </Text>
      </View>
      <GraficoPid muestras={muestras} />
      {props.error ? (
        <Text accessibilityRole="alert" style={estilos.error}>
          {props.error}
        </Text>
      ) : props.mensaje ? (
        <Text style={estilos.secundario}>{props.mensaje}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={
          props.enCurso
            ? props.deteniendo
            : props.deshabilitado || !seleccionDisponible
        }
        onPress={() => {
          if (props.enCurso) props.alDetener();
          else if (seleccionado) props.alIniciar(seleccionado);
        }}
        style={[
          estilos.boton,
          (props.deteniendo ||
            (!props.enCurso &&
              (props.deshabilitado || !seleccionDisponible))) &&
            estilos.deshabilitado,
        ]}
      >
        <Text style={estilos.textoBoton}>
          {props.deteniendo
            ? 'Deteniendo…'
            : props.enCurso
            ? 'Detener lectura'
            : 'Iniciar lectura'}
        </Text>
      </Pressable>
      {props.informe && !props.enCurso ? (
        <View style={estilos.captura}>
          <Text style={estilos.secundario}>
            Captura {props.informe.comando} · {props.informe.capturas.length} de{' '}
            {props.informe.cantidadConsultas} consultas conservadas
          </Text>
          {props.informe.medicion ? (
            <Text style={estilos.secundario}>
              {props.informe.medicion.nombre} · {props.informe.medicion.unidad}
            </Text>
          ) : null}
          {props.informe.cabecerasConfirmadas ? (
            <Text style={estilos.secundario}>Cabeceras activadas · ATH1</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => establecerMostrarCaptura(!mostrarCaptura)}
            style={estilos.botonSecundario}
          >
            <Text style={estilos.textoBoton}>
              {mostrarCaptura
                ? 'Ocultar captura técnica'
                : 'Ver captura técnica'}
            </Text>
          </Pressable>
          {mostrarCaptura ? (
            <Text selectable style={estilos.json}>
              {JSON.stringify(
                ultimaCaptura ?? { error: props.informe.error, capturas: [] },
                null,
                2,
              )}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={props.capturaOcupada || !props.alGuardarCaptura}
            onPress={props.alGuardarCaptura}
            style={[
              estilos.botonSecundario,
              props.capturaOcupada && estilos.deshabilitado,
            ]}
          >
            <Text style={estilos.textoBoton}>Guardar captura JSON</Text>
          </Pressable>
          {props.mensajeCaptura ? (
            <Text accessibilityRole="alert" style={estilos.secundario}>
              {props.mensajeCaptura}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export interface PropiedadesRegistroHistorico {
  pidsCompatibles: readonly string[] | null;
  enCurso: boolean;
  estado: string;
  restanteMs: number;
  deshabilitado: boolean;
  ocupado: boolean;
  registro: RegistroHistoricoPids | null;
  error: string | null;
  mensajeGuardado: string | null;
  alIniciar: (comandos: readonly string[], duracionMs: number) => void;
  alDetener: () => void;
  alGuardar: () => void;
  usoTaller?: boolean;
}

export function PanelRegistroHistoricoPids(
  props: PropiedadesRegistroHistorico,
) {
  const estilos = useEstilosTematicos(estilosBase);
  const disponibles = useMemo(
    () => obtenerMedicionesGraficables(props.pidsCompatibles),
    [props.pidsCompatibles],
  );
  const [seleccionados, establecerSeleccionados] = useState<string[]>([]);
  const [duracion, establecerDuracion] = useState<number>(60000);
  useEffect(() => {
    if (props.enCurso) return;
    establecerSeleccionados(anteriores => {
      const compatibles = anteriores.filter(pid =>
        disponibles.some(disponible => disponible.comando === pid),
      );
      return compatibles.length
        ? compatibles
        : disponibles.length
        ? [disponibles[0].comando]
        : [];
    });
  }, [disponibles, props.enCurso]);
  const seleccionar = useCallback((comando: string) => {
    establecerSeleccionados(anteriores =>
      anteriores.includes(comando)
        ? anteriores.filter(item => item !== comando)
        : anteriores.length < 3
        ? [...anteriores, comando]
        : anteriores,
    );
  }, []);
  const bloquear = props.enCurso || props.deshabilitado;
  if (
    props.usoTaller &&
    props.pidsCompatibles === null &&
    !props.registro &&
    !props.enCurso
  )
    return null;
  return (
    <View style={estilos.panel}>
      <Text style={estilos.titulo}>Registro histórico</Text>
      {disponibles.length === 0 ? (
        <Text style={estilos.secundario}>
          Detecta los PID compatibles para registrar.
        </Text>
      ) : (
        <>
          <SelectorMediciones
            disponibles={disponibles}
            seleccionados={seleccionados}
            multiple
            deshabilitado={bloquear}
            alSeleccionar={seleccionar}
            usoTaller={props.usoTaller}
          />
          {seleccionados.length ? (
            <Text style={[estilos.secundario, estilos.separacion]}>
              {seleccionados
                .map(comando => obtenerMedicionGraficaPid(comando)?.nombre)
                .join(' · ')}
            </Text>
          ) : null}
          <Text style={[estilos.secundario, estilos.separacion]}>
            Hasta 3 PID · Duración
          </Text>
          <View style={estilos.opciones}>
            {DURACIONES_REGISTRO_MS.map(ms => (
              <Pressable
                key={ms}
                accessibilityRole="radio"
                accessibilityLabel={`Duración ${ms / 60000} minutos`}
                accessibilityState={{
                  checked: duracion === ms,
                  disabled: bloquear,
                }}
                disabled={bloquear}
                onPress={() => establecerDuracion(ms)}
                style={[
                  estilos.opcion,
                  duracion === ms && estilos.seleccionada,
                ]}
              >
                <Text style={estilos.textoOpcion}>{ms / 60000} min</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {props.enCurso ? (
        <Text style={[estilos.secundario, estilos.separacion]}>
          {props.estado === 'preparando'
            ? 'Preparando escáner…'
            : props.estado === 'deteniendo' || props.restanteMs === 0
            ? 'Finalizando consulta…'
            : `Tiempo restante · ${formatearTiempoGrafico(
                props.restanteMs,
                true,
              )}`}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={
          props.enCurso
            ? props.estado === 'deteniendo'
            : props.deshabilitado || seleccionados.length === 0
        }
        onPress={() =>
          props.enCurso
            ? props.alDetener()
            : props.alIniciar([...seleccionados], duracion)
        }
        style={[
          estilos.boton,
          (props.enCurso
            ? props.estado === 'deteniendo'
            : props.deshabilitado || seleccionados.length === 0) &&
            estilos.deshabilitado,
        ]}
      >
        <Text style={estilos.textoBoton}>
          {props.enCurso
            ? props.estado === 'deteniendo'
              ? 'Deteniendo…'
              : 'Detener registro'
            : 'Iniciar registro'}
        </Text>
      </Pressable>
      {props.error ? (
        <Text accessibilityRole="alert" style={estilos.error}>
          {props.error}
        </Text>
      ) : null}
      {props.registro && !props.enCurso ? (
        <View style={estilos.captura}>
          <Text style={estilos.textoOpcion}>
            {props.registro.estado === 'completo'
              ? 'Registro completo'
              : 'Registro parcial'}{' '}
            · {formatearTiempoGrafico(props.registro.duracionRealMs)}
          </Text>
          <Text style={estilos.secundario}>{props.registro.motivoFin}</Text>
          <GraficosRegistroPids
            series={props.registro.series}
            duracionMs={props.registro.duracionRealMs}
            identidad={props.registro}
          />
          {!props.usoTaller ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={props.ocupado}
                onPress={props.alGuardar}
                style={[
                  estilos.botonSecundario,
                  props.ocupado && estilos.deshabilitado,
                ]}
              >
                <Text style={estilos.textoBoton}>Guardar registro JSON</Text>
              </Pressable>
              <Text style={estilos.secundario}>
                El registro está en memoria. Expórtalo antes de salir o iniciar
                otro.
              </Text>
            </>
          ) : null}
          {props.mensajeGuardado ? (
            <Text accessibilityRole="alert" style={estilos.secundario}>
              {props.mensajeGuardado}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

interface SerieGrafico {
  comando: string;
  nombre: string;
  unidad: string;
  muestras: readonly MuestraPid[];
  error?: string | null;
}

// dibujo igual una captura recien terminada y una recuperada, sin inventar datos tecnicos
export function GraficosRegistroPids({
  series,
  duracionMs,
  identidad,
}: {
  series: readonly SerieGrafico[];
  duracionMs: number;
  identidad?: unknown;
}) {
  const estilos = useEstilosTematicos(estilosBase);
  const [ampliada, establecerAmpliada] = useState<SerieGrafico | null>(null);
  useEffect(() => establecerAmpliada(null), [series, identidad]);
  const ventana = useMemo(
    () => ({ inicio: 0, fin: Math.max(1000, duracionMs) }),
    [duracionMs],
  );
  return (
    <>
      {series.map(serie => {
        const validas = serie.muestras.filter(
          muestra => muestra.valor !== null,
        );
        const intervalo =
          validas.length > 1
            ? validas[validas.length - 1].tiempoTranscurridoMs -
              validas[0].tiempoTranscurridoMs
            : 0;
        return (
          <View key={serie.comando} style={estilos.serieHistorica}>
            <View style={estilos.cabeceraHistorica}>
              <Text style={[estilos.textoOpcion, estilos.nombreHistorico]}>
                {serie.nombre} · {serie.unidad}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ampliar gráfico ${serie.comando}`}
                disabled={!serie.muestras.length}
                onPress={() => establecerAmpliada(serie)}
                style={estilos.ampliar}
              >
                <Text style={estilos.textoOpcion}>Ampliar</Text>
              </Pressable>
            </View>
            <Text style={estilos.secundario}>
              {validas.length} mediciones
              {intervalo > 0
                ? ` · ${(((validas.length - 1) * 1000) / intervalo).toFixed(
                    2,
                  )} lecturas/s`
                : ''}
            </Text>
            <GraficoPid
              muestras={serie.muestras}
              ventana={ventana}
              historico
              altura={230}
            />
            {serie.error ? (
              <Text style={estilos.error}>{serie.error}</Text>
            ) : null}
          </View>
        );
      })}
      {ampliada && series.includes(ampliada) ? (
        <GraficoHistoricoAmpliado
          serie={ampliada}
          duracionMs={duracionMs}
          alCerrar={() => establecerAmpliada(null)}
        />
      ) : null}
    </>
  );
}

const estilosBase = StyleSheet.create({
  panel: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  titulo: {
    color: '#F4F4F5',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grupo: { marginBottom: 8 },
  categoria: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  opcion: {
    borderWidth: 1,
    borderColor: '#38383D',
    borderRadius: 10,
    padding: 10,
  },
  seleccionada: { borderColor: '#10A37F', backgroundColor: '#11241F' },
  textoOpcion: { color: '#D4D4D8', fontSize: 12 },
  cabeceraValor: { marginTop: 18, marginBottom: 8, gap: 6 },
  valor: { color: '#F4F4F5', fontSize: 29, fontWeight: '700' },
  unidad: { color: '#929299', fontSize: 14 },
  secundario: { color: '#929299', fontSize: 12, lineHeight: 18 },
  serieHistorica: { marginTop: 12, marginBottom: 8, gap: 8 },
  cabeceraHistorica: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nombreHistorico: { flex: 1, fontSize: 14 },
  ampliar: {
    borderWidth: 1,
    borderColor: '#38383D',
    borderRadius: 10,
    padding: 10,
  },
  error: { color: '#FFB4AB', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  boton: {
    backgroundColor: '#10A37F',
    padding: 12,
    borderRadius: 11,
    alignItems: 'center',
    marginTop: 12,
  },
  textoBoton: { color: '#FFFFFF', fontWeight: '700' },
  deshabilitado: { opacity: 0.4 },
  captura: { marginTop: 16, gap: 8 },
  separacion: { marginTop: 12, marginBottom: 8 },
  botonSecundario: {
    borderColor: '#38383D',
    borderWidth: 1,
    padding: 12,
    borderRadius: 11,
    alignItems: 'center',
  },
  json: {
    color: '#D4D4D8',
    backgroundColor: '#0D0D0E',
    padding: 10,
    borderRadius: 10,
    fontFamily: 'monospace',
    fontSize: 11,
  },
});
