import { useColoresTema, useEstilosTematicos } from '../tema/tokensTema';
import React, {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  Rect,
  Text as TextoSvg,
} from 'react-native-svg';
import type { MuestraPid } from '../obd/MuestreoPids';

export interface VentanaPid {
  inicio: number;
  fin: number;
}

// el tiempo restante sube al segundo siguiente; una duracion ya terminada no
export function formatearTiempoGrafico(ms: number, restante = false): string {
  const seguro = Number.isFinite(ms) ? Math.max(0, ms) / 1000 : 0;
  const segundos = restante ? Math.ceil(seguro) : Math.floor(seguro);
  return `${Math.floor(segundos / 60)}:${(segundos % 60)
    .toString()
    .padStart(2, '0')}`;
}

export function formatearInstantePid(ms: number): string {
  const redondeado = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
  return `${formatearTiempoGrafico(redondeado)}.${(redondeado % 1000)
    .toString()
    .padStart(3, '0')}`;
}

export function limitarVentanaPid(
  inicio: number,
  duracion: number,
  total: number,
): VentanaPid {
  const limite = Number.isFinite(total) ? Math.max(1, total) : 1;
  const ancho =
    Number.isFinite(duracion) && duracion > 0
      ? Math.min(duracion, limite)
      : limite;
  const desde = Number.isFinite(inicio)
    ? Math.max(0, Math.min(inicio, limite - ancho))
    : 0;
  return { inicio: desde, fin: desde + ancho };
}

function indiceDesde(muestras: readonly MuestraPid[], tiempo: number): number {
  let izquierda = 0;
  let derecha = muestras.length;
  while (izquierda < derecha) {
    const medio = Math.floor((izquierda + derecha) / 2);
    if (muestras[medio].tiempoTranscurridoMs < tiempo) izquierda = medio + 1;
    else derecha = medio;
  }
  return izquierda;
}

export function muestrasEnVentana(
  muestras: readonly MuestraPid[],
  ventana: VentanaPid,
): readonly MuestraPid[] {
  // incluyo un vecino a cada lado para recortar el trazo sin perder sus bordes
  const primero = Math.max(0, indiceDesde(muestras, ventana.inicio) - 1);
  const ultimo = Math.min(
    muestras.length,
    indiceDesde(muestras, ventana.fin) + 1,
  );
  return muestras.slice(primero, ultimo);
}

export function buscarMuestraPid(
  muestras: readonly MuestraPid[],
  tiempo: number,
  ventana: VentanaPid,
): MuestraPid | null {
  const indice = indiceDesde(muestras, tiempo);
  const candidatas = [muestras[indice - 1], muestras[indice]].filter(
    (muestra): muestra is MuestraPid =>
      !!muestra &&
      muestra.tiempoTranscurridoMs >= ventana.inicio &&
      muestra.tiempoTranscurridoMs <= ventana.fin,
  );
  return candidatas.reduce<MuestraPid | null>(
    (elegida, muestra) =>
      !elegida ||
      Math.abs(muestra.tiempoTranscurridoMs - tiempo) <
        Math.abs(elegida.tiempoTranscurridoMs - tiempo)
        ? muestra
        : elegida,
    null,
  );
}

export interface EscalaGraficoPid {
  minimo: number;
  maximo: number;
  paso: number;
}

export function calcularEscalaPid(
  muestras: readonly MuestraPid[],
  historico = true,
): EscalaGraficoPid {
  const valores = muestras.flatMap(item =>
    item.valor !== null && Number.isFinite(item.valor) ? [item.valor] : [],
  );
  if (!valores.length) return { minimo: 0, maximo: 1, paso: 0.5 };
  const menor = Math.min(...valores);
  const mayor = Math.max(...valores);
  const margen = Math.max((mayor - menor) * 0.1, Math.abs(mayor) * 0.02, 0.5);
  if (!historico)
    return {
      minimo: menor - margen,
      maximo: mayor + margen,
      paso: (mayor - menor + margen * 2) / 2,
    };
  const aproximado = (mayor - menor + margen * 2) / 4;
  const potencia = 10 ** Math.floor(Math.log10(aproximado));
  const factor = [1, 2, 2.5, 5, 10].find(
    numero => numero * potencia >= aproximado,
  )!;
  const paso = factor * potencia;
  return {
    minimo: Math.floor((menor - margen) / paso) * paso,
    maximo: Math.ceil((mayor + margen) / paso) * paso,
    paso,
  };
}

interface PropiedadesGrafico {
  muestras: readonly MuestraPid[];
  ventana?: VentanaPid;
  historico?: boolean;
  altura?: number;
  seleccionada?: MuestraPid | null;
  alSeleccionar?: (muestra: MuestraPid | null) => void;
  alDesplazar?: (inicioMs: number) => void;
}

export const GraficoPid = memo(function DibujoPid({
  muestras,
  ventana,
  historico = false,
  altura = 205,
  seleccionada = null,
  alSeleccionar,
  alDesplazar,
}: PropiedadesGrafico) {
  const estilos = useEstilosTematicos(estilosBase);
  const colores = useColoresTema();
  const [ancho, establecerAncho] = useState(340);
  const identificador = `recorte${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const escala = useMemo(
    () => calcularEscalaPid(muestras, historico),
    [muestras, historico],
  );
  const izquierda = historico ? 64 : 54;
  const derecha = historico ? Math.max(izquierda + 20, ancho - 20) : 320;
  const arriba = 18;
  const abajo = altura - 40;
  const ultimaMarca = muestras[muestras.length - 1]?.tiempoTranscurridoMs ?? 0;
  const inicio = ventana?.inicio ?? Math.max(0, ultimaMarca - 60000);
  const fin = ventana?.fin ?? Math.max(inicio + 10000, ultimaMarca);
  const intervalo = useMemo(() => ({ inicio, fin }), [inicio, fin]);
  const visibles = useMemo(
    () => (historico ? muestrasEnVentana(muestras, intervalo) : muestras),
    [muestras, intervalo, historico],
  );
  const actuales = useRef({
    muestras,
    intervalo,
    izquierda,
    derecha,
    alSeleccionar,
    alDesplazar,
  });
  actuales.current = {
    muestras,
    intervalo,
    izquierda,
    derecha,
    alSeleccionar,
    alDesplazar,
  };
  const gesto = useRef({ inicio: 0, desplazado: false });
  const pendiente = useRef<number | null>(null);
  const cuadro = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const cancelarCuadro = () => {
    if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
    cuadro.current = null;
  };
  useEffect(() => () => cancelarCuadro(), []);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !!actuales.current.alSeleccionar || !!actuales.current.alDesplazar,
        onMoveShouldSetPanResponder: (_evento, estado) =>
          !!actuales.current.alDesplazar &&
          Math.abs(estado.dx) > 6 &&
          Math.abs(estado.dx) > Math.abs(estado.dy),
        onPanResponderGrant: () => {
          cancelarCuadro();
          pendiente.current = null;
          gesto.current = {
            inicio: actuales.current.intervalo.inicio,
            desplazado: false,
          };
        },
        onPanResponderMove: (_evento, estado) => {
          if (estado.numberActiveTouches > 1 || Math.abs(estado.dy) > 6)
            gesto.current.desplazado = true;
          if (
            estado.numberActiveTouches > 1 ||
            Math.abs(estado.dx) <= 6 ||
            Math.abs(estado.dx) <= Math.abs(estado.dy)
          )
            return;
          gesto.current.desplazado = true;
          const actual = actuales.current;
          if (!actual.alDesplazar) return;
          pendiente.current =
            gesto.current.inicio -
            (estado.dx * (actual.intervalo.fin - actual.intervalo.inicio)) /
              (actual.derecha - actual.izquierda);
          // agrupo los movimientos por cuadro para no redibujar en cada evento tactil
          if (cuadro.current === null)
            cuadro.current = requestAnimationFrame(() => {
              cuadro.current = null;
              if (pendiente.current !== null)
                actuales.current.alDesplazar?.(pendiente.current);
            });
        },
        onPanResponderRelease: evento => {
          cancelarCuadro();
          const actual = actuales.current;
          if (gesto.current.desplazado) {
            if (pendiente.current !== null)
              actual.alDesplazar?.(pendiente.current);
          } else {
            const proporcion = Math.max(
              0,
              Math.min(
                1,
                (evento.nativeEvent.locationX - actual.izquierda) /
                  (actual.derecha - actual.izquierda),
              ),
            );
            actual.alSeleccionar?.(
              buscarMuestraPid(
                actual.muestras,
                actual.intervalo.inicio +
                  proporcion * (actual.intervalo.fin - actual.intervalo.inicio),
                actual.intervalo,
              ),
            );
          }
          pendiente.current = null;
        },
        onPanResponderTerminate: () => {
          cancelarCuadro();
          pendiente.current = null;
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [],
  );

  const hayValidas = muestras.some(
    item => item.valor !== null && Number.isFinite(item.valor),
  );
  if (!hayValidas)
    return (
      <View style={[estilos.vacio, { minHeight: altura }]}>
        <Text style={estilos.secundario}>Sin muestras válidas.</Text>
      </View>
    );
  const x = (tiempo: number) =>
    izquierda + ((tiempo - inicio) * (derecha - izquierda)) / (fin - inicio);
  const y = (valor: number) =>
    abajo -
    ((valor - escala.minimo) * (abajo - arriba)) /
      (escala.maximo - escala.minimo);
  const segmentos: string[] = [];
  const marcadores: (MuestraPid & { valor: number })[] = [];
  let comenzar = true;
  let cantidadTramo = 0;
  let ultimoPunto: (MuestraPid & { valor: number }) | null = null;
  for (const muestra of visibles) {
    if (muestra.valor === null || !Number.isFinite(muestra.valor)) {
      if (cantidadTramo === 1 && ultimoPunto) marcadores.push(ultimoPunto);
      cantidadTramo = 0;
      comenzar = true;
      continue;
    }
    // no uno dos tramos a traves de una lectura fallida
    segmentos.push(
      `${comenzar ? 'M' : 'L'}${x(muestra.tiempoTranscurridoMs).toFixed(2)},${y(
        muestra.valor,
      ).toFixed(2)}`,
    );
    ultimoPunto = muestra as MuestraPid & { valor: number };
    cantidadTramo += 1;
    comenzar = false;
  }
  if (ultimoPunto && !marcadores.includes(ultimoPunto))
    marcadores.push(ultimoPunto);
  const marcasY = historico
    ? Array.from(
        {
          length: Math.round((escala.maximo - escala.minimo) / escala.paso) + 1,
        },
        (_, indice) => escala.minimo + indice * escala.paso,
      )
    : [escala.minimo, (escala.minimo + escala.maximo) / 2, escala.maximo];
  const decimales = Math.max(
    0,
    Math.min(
      4,
      -Math.floor(Math.log10(escala.paso)) +
        (escala.paso / 10 ** Math.floor(Math.log10(escala.paso)) === 2.5
          ? 1
          : 0),
    ),
  );
  return (
    <View
      accessibilityLabel="Gráfico de evolución del PID"
      style={estilos.grafico}
      onLayout={
        historico
          ? evento => {
              const siguiente = Math.round(evento.nativeEvent.layout.width);
              if (siguiente > 0) establecerAncho(siguiente);
            }
          : undefined
      }
      {...(alSeleccionar || alDesplazar ? responder.panHandlers : {})}
    >
      <Svg
        pointerEvents={alSeleccionar || alDesplazar ? 'none' : 'auto'}
        width="100%"
        height={altura}
        viewBox={`0 0 ${historico ? ancho : 340} ${altura}`}
      >
        <Defs>
          <ClipPath id={identificador}>
            <Rect
              x={izquierda}
              y={arriba}
              width={derecha - izquierda}
              height={abajo - arriba}
            />
          </ClipPath>
        </Defs>
        {marcasY.map(valor => (
          <React.Fragment key={valor}>
            <Line
              x1={izquierda}
              x2={derecha}
              y1={y(valor)}
              y2={y(valor)}
              stroke={colores.borde}
            />
            <TextoSvg
              x={izquierda - 7}
              y={y(valor) + 4}
              textAnchor="end"
              fill={colores.textoSecundario}
              fontSize={historico ? 11 : 10}
            >
              {historico
                ? valor.toLocaleString('es-CL', {
                    maximumFractionDigits: decimales,
                  })
                : valor.toFixed(1)}
            </TextoSvg>
          </React.Fragment>
        ))}
        <G clipPath={`url(#${identificador})`}>
          <Path
            d={segmentos.join(' ')}
            stroke={colores.primario}
            strokeWidth={historico ? 1.5 : 2}
            fill="none"
          />
          {marcadores.map(muestra => (
            <Circle
              key={muestra.tiempoTranscurridoMs}
              cx={x(muestra.tiempoTranscurridoMs)}
              cy={y(muestra.valor)}
              r={2}
              fill={colores.primario}
            />
          ))}
          {seleccionada ? (
            <>
              <Line
                x1={x(seleccionada.tiempoTranscurridoMs)}
                x2={x(seleccionada.tiempoTranscurridoMs)}
                y1={arriba}
                y2={abajo}
                stroke={colores.texto}
                strokeDasharray="4 4"
              />
              {seleccionada.valor !== null ? (
                <Circle
                  cx={x(seleccionada.tiempoTranscurridoMs)}
                  cy={y(seleccionada.valor)}
                  r={4}
                  fill={colores.texto}
                  stroke={colores.fondo}
                  strokeWidth={1}
                />
              ) : null}
            </>
          ) : null}
        </G>
        {[0, 0.5, 1].map(fraccion => (
          <TextoSvg
            key={fraccion}
            x={izquierda + (derecha - izquierda) * fraccion}
            y={altura - 17}
            textAnchor={
              fraccion === 0 ? 'start' : fraccion === 1 ? 'end' : 'middle'
            }
            fill={colores.textoSecundario}
            fontSize={historico ? 11 : 10}
          >
            {historico
              ? formatearTiempoGrafico(inicio + (fin - inicio) * fraccion)
              : `${((inicio + (fin - inicio) * fraccion) / 1000).toFixed(0)} s`}
          </TextoSvg>
        ))}
      </Svg>
    </View>
  );
});

interface SerieAmpliada {
  comando: string;
  nombre: string;
  unidad: string;
  muestras: readonly MuestraPid[];
}

export function GraficoHistoricoAmpliado({
  serie,
  duracionMs,
  alCerrar,
}: {
  serie: SerieAmpliada;
  duracionMs: number;
  alCerrar: () => void;
}) {
  const estilos = useEstilosTematicos(estilosBase);
  const colores = useColoresTema();
  const dimensiones = useWindowDimensions();
  const [duracionVentanaMs, establecerDuracionVentana] = useState(0);
  const [inicioVentanaMs, establecerInicioVentana] = useState(0);
  const [muestraSeleccionada, establecerMuestra] = useState<MuestraPid | null>(
    null,
  );
  const total = Math.max(1000, duracionMs);
  const ventana = useMemo(
    () => limitarVentanaPid(inicioVentanaMs, duracionVentanaMs, total),
    [inicioVentanaMs, duracionVentanaMs, total],
  );
  const desplazar = (inicio: number) => {
    establecerInicioVentana(
      limitarVentanaPid(inicio, duracionVentanaMs, total).inicio,
    );
    establecerMuestra(null);
  };
  const altura = Math.max(160, dimensiones.height - 320);
  return (
    <Modal visible animationType="fade" onRequestClose={alCerrar}>
      <SafeAreaProvider
        initialMetrics={
          initialWindowMetrics ?? {
            frame: {
              x: 0,
              y: 0,
              width: dimensiones.width,
              height: dimensiones.height,
            },
            insets: { top: 0, bottom: 0, left: 0, right: 0 },
          }
        }
      >
        <SafeAreaView style={estilos.modal}>
          <ScrollView contentContainerStyle={estilos.contenidoModal}>
            <View style={estilos.cabecera}>
              <Text style={estilos.titulo}>
                {serie.nombre} · {serie.unidad}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar gráfico ampliado"
                onPress={alCerrar}
                style={estilos.boton}
              >
                <Text style={estilos.textoBoton}>Cerrar</Text>
              </Pressable>
            </View>
            <View style={estilos.controles}>
              {[
                [0, 'Completo'],
                [30000, '30 segundos'],
                [60000, '1 minuto'],
              ].map(([duracion, nombre]) => (
                <Pressable
                  key={duracion}
                  accessibilityRole="radio"
                  accessibilityLabel={`Ventana ${nombre}`}
                  accessibilityState={{
                    checked: duracionVentanaMs === duracion,
                  }}
                  onPress={() => {
                    const siguiente = Number(duracion);
                    establecerDuracionVentana(siguiente);
                    establecerInicioVentana(
                      limitarVentanaPid(inicioVentanaMs, siguiente, total)
                        .inicio,
                    );
                    establecerMuestra(null);
                  }}
                  style={[
                    estilos.boton,
                    duracionVentanaMs === duracion && estilos.seleccionado,
                  ]}
                >
                  <Text style={estilos.textoBoton}>{nombre}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={estilos.secundario}>
              {formatearTiempoGrafico(ventana.inicio)} —{' '}
              {formatearTiempoGrafico(ventana.fin)}
            </Text>
            <GraficoPid
              muestras={serie.muestras}
              ventana={ventana}
              historico
              altura={altura}
              seleccionada={muestraSeleccionada}
              alSeleccionar={establecerMuestra}
              alDesplazar={
                duracionVentanaMs > 0 && ventana.fin - ventana.inicio < total
                  ? desplazar
                  : undefined
              }
            />
            <View style={estilos.lectura}>
              <Text
                accessibilityLabel="Medición seleccionada"
                style={estilos.textoLectura}
              >
                {muestraSeleccionada
                  ? `${formatearInstantePid(
                      muestraSeleccionada.tiempoTranscurridoMs,
                    )} · ${
                      muestraSeleccionada.valor === null
                        ? 'Sin lectura'
                        : `${muestraSeleccionada.valor.toLocaleString('es-CL', {
                            maximumFractionDigits: 4,
                          })} ${serie.unidad}`
                    }`
                  : 'Toca la curva para consultar una medición.'}
              </Text>
              {muestraSeleccionada?.error ? (
                <Text style={[estilos.error, { color: colores.error }]}>
                  {muestraSeleccionada.error}
                </Text>
              ) : null}
            </View>
            <View style={estilos.navegacion}>
              {[-1, 1].map(sentido => {
                const deshabilitado =
                  sentido < 0 ? ventana.inicio <= 0 : ventana.fin >= total;
                const nombre = sentido < 0 ? 'Anterior' : 'Siguiente';
                return (
                  <Pressable
                    key={sentido}
                    accessibilityRole="button"
                    accessibilityLabel={`${nombre} intervalo`}
                    disabled={deshabilitado}
                    onPress={() => {
                      if (!deshabilitado)
                        desplazar(
                          ventana.inicio +
                            sentido * (ventana.fin - ventana.inicio),
                        );
                    }}
                    style={[
                      estilos.boton,
                      deshabilitado && estilos.deshabilitado,
                    ]}
                  >
                    <Text style={estilos.textoBoton}>{nombre}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const estilosBase = StyleSheet.create({
  grafico: { backgroundColor: '#0D0D0E', borderRadius: 10, marginBottom: 12 },
  vacio: { alignItems: 'center', justifyContent: 'center' },
  secundario: { color: '#929299', fontSize: 12, lineHeight: 18 },
  modal: { flex: 1, backgroundColor: '#171719' },
  contenidoModal: { padding: 16, gap: 12, flexGrow: 1 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titulo: { flex: 1, color: '#F4F4F5', fontSize: 17, fontWeight: '700' },
  controles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boton: {
    borderColor: '#38383D',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  textoBoton: { color: '#D4D4D8', fontSize: 13 },
  seleccionado: { borderColor: '#10A37F', backgroundColor: '#11241F' },
  lectura: { minHeight: 44, gap: 4 },
  textoLectura: { color: '#F4F4F5', fontSize: 15 },
  error: { color: '#FFB4AB', fontSize: 12 },
  navegacion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deshabilitado: { opacity: 0.4 },
});
