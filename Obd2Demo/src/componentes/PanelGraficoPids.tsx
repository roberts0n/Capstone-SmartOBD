import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as TextoSvg } from 'react-native-svg';
import { obtenerDefinicionPidMode01 } from '../obd/CatalogoPidsMode01';
import {
  PIDS_GRAFICABLES_INICIALES,
  type MuestraPid,
} from '../obd/MuestreoPids';

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
}

export function PanelGraficoPids(props: Propiedades) {
  const disponibles = PIDS_GRAFICABLES_INICIALES.filter(pid =>
    props.pidsCompatibles?.includes(pid),
  );
  const [seleccionado, establecerSeleccionado] = useState<string | null>(null);
  const primero = disponibles[0] ?? null;
  const seleccionDisponible =
    seleccionado !== null && disponibles.some(pid => pid === seleccionado);
  useEffect(() => {
    if (!seleccionDisponible && !props.enCurso) establecerSeleccionado(primero);
  }, [seleccionDisponible, primero, props.enCurso]);
  const muestras = props.comandoActivo === seleccionado ? props.muestras : [];
  const ultima = muestras[muestras.length - 1];
  return (
    <View style={estilos.panel}>
      <Text style={estilos.titulo}>Lectura en vivo</Text>
      {props.pidsCompatibles === null ? (
        <Text style={estilos.secundario}>
          Detecta los PID compatibles para elegir una medición.
        </Text>
      ) : disponibles.length === 0 ? (
        <Text style={estilos.secundario}>
          No se detectó ninguno de los cuatro PID de esta prueba.
        </Text>
      ) : (
        <View style={estilos.opciones}>
          {disponibles.map(pid => (
            <Pressable
              key={pid}
              accessibilityRole="radio"
              accessibilityLabel={`Graficar ${pid}`}
              accessibilityState={{
                checked: seleccionado === pid,
                disabled: props.enCurso || props.deshabilitado,
              }}
              disabled={props.enCurso || props.deshabilitado}
              onPress={() => {
                if (pid !== seleccionado) {
                  props.alLimpiar();
                  establecerSeleccionado(pid);
                }
              }}
              style={[
                estilos.opcion,
                seleccionado === pid && estilos.seleccionada,
              ]}
            >
              <Text style={estilos.textoOpcion}>
                {obtenerDefinicionPidMode01(pid)?.nombre}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={estilos.cabeceraValor}>
        <Text accessibilityLabel="Valor en vivo" style={estilos.valor}>
          {ultima?.valor == null
            ? '—'
            : ultima.valor.toLocaleString('es-CL', {
                maximumFractionDigits: 2,
              })}
          <Text style={estilos.unidad}> {ultima?.unidad ?? ''}</Text>
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
    </View>
  );
}

function GraficoPid({ muestras }: { muestras: readonly MuestraPid[] }) {
  const validas = muestras.filter(
    (item): item is MuestraPid & { valor: number } => item.valor !== null,
  );
  if (!validas.length)
    return (
      <View style={estilos.vacio}>
        <Text style={estilos.secundario}>Sin muestras válidas.</Text>
      </View>
    );
  const izquierda = 54,
    derecha = 320,
    arriba = 18,
    abajo = 165;
  const ultimaMarca = muestras[muestras.length - 1].tiempoTranscurridoMs;
  const inicio = Math.max(0, ultimaMarca - 60000);
  const final = Math.max(inicio + 10000, ultimaMarca);
  const valores = validas.map(item => item.valor);
  const menor = Math.min(...valores),
    mayor = Math.max(...valores);
  const margen = Math.max((mayor - menor) * 0.1, Math.abs(mayor) * 0.02, 0.5);
  const minimo = menor - margen,
    maximo = mayor + margen;
  const x = (tiempo: number) =>
    izquierda + ((tiempo - inicio) * (derecha - izquierda)) / (final - inicio);
  const y = (valor: number) =>
    abajo - ((valor - minimo) * (abajo - arriba)) / (maximo - minimo);
  let comenzar = true;
  const segmentos: string[] = [];
  for (const muestra of muestras) {
    if (muestra.valor === null) {
      comenzar = true;
      continue;
    }
    // un error corta la curva, no lo dibujo como cero ni uno dos tramos separados
    segmentos.push(
      `${comenzar ? 'M' : 'L'}${x(muestra.tiempoTranscurridoMs).toFixed(2)},${y(
        muestra.valor,
      ).toFixed(2)}`,
    );
    comenzar = false;
  }
  return (
    <View
      accessibilityLabel="Gráfico de evolución del PID"
      style={estilos.grafico}
    >
      <Svg width="100%" height={205} viewBox="0 0 340 205">
        {[0, 0.5, 1].map(fraccion => {
          const valor = minimo + (maximo - minimo) * fraccion;
          return (
            <React.Fragment key={fraccion}>
              <Line
                x1={izquierda}
                x2={derecha}
                y1={y(valor)}
                y2={y(valor)}
                stroke="#303034"
              />
              <TextoSvg
                x={izquierda - 7}
                y={y(valor) + 4}
                textAnchor="end"
                fill="#929299"
                fontSize={10}
              >
                {valor.toFixed(1)}
              </TextoSvg>
            </React.Fragment>
          );
        })}
        <Path
          d={segmentos.join(' ')}
          stroke="#5BE0BB"
          strokeWidth={2}
          fill="none"
        />
        {validas.map(muestra => (
          <Circle
            key={muestra.tiempoTranscurridoMs}
            cx={x(muestra.tiempoTranscurridoMs)}
            cy={y(muestra.valor)}
            r={2}
            fill="#5BE0BB"
          />
        ))}
        {[0, 0.5, 1].map(fraccion => (
          <TextoSvg
            key={fraccion}
            x={izquierda + (derecha - izquierda) * fraccion}
            y={188}
            textAnchor={
              fraccion === 0 ? 'start' : fraccion === 1 ? 'end' : 'middle'
            }
            fill="#929299"
            fontSize={10}
          >
            {((inicio + (final - inicio) * fraccion) / 1000).toFixed(0)} s
          </TextoSvg>
        ))}
      </Svg>
    </View>
  );
}

const estilos = StyleSheet.create({
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
  grafico: { backgroundColor: '#0D0D0E', borderRadius: 10, marginBottom: 12 },
  vacio: { minHeight: 205, alignItems: 'center', justifyContent: 'center' },
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
});
