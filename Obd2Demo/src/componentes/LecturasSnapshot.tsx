import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  CatalogoPid,
  NuevoValorPidSnapshot,
  ValorJson,
} from '../diagnosticos/TiposSnapshotDiagnostico';

interface CampoLectura {
  etiqueta: string;
  valor: string;
}

interface LecturaPresentada {
  campos: CampoLectura[];
  monitores?: CampoLectura[];
  advertencia?: string;
}

const SIN_DATO = 'Sin dato';
// los conservo en el snapshot, pero no son mediciones para el resumen del mecanico
const PARAMETROS_INTERNOS = new Set(['014F', '0150']);
const AJUSTES_POR_BANCO = new Set([
  '0106',
  '0107',
  '0108',
  '0109',
  '0155',
  '0156',
  '0157',
  '0158',
]);

function objeto(valor: ValorJson): Record<string, ValorJson> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor
    : null;
}

function texto(valor: ValorJson | undefined): string | null {
  return typeof valor === 'string' && valor.trim() ? valor : null;
}

function magnitud(
  valor: ValorJson | undefined,
  unidad?: string | null,
): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return SIN_DATO;
  return `${String(valor).replace('.', ',')}${unidad ? ` ${unidad}` : ''}`;
}

function listaTexto(valor: ValorJson | undefined): string[] {
  return Array.isArray(valor)
    ? valor.filter(
        (item): item is string => typeof item === 'string' && !!item.trim(),
      )
    : [];
}

function presentarMonitores(
  datos: Record<string, ValorJson>,
  cicloActual: boolean,
): LecturaPresentada {
  const campos: CampoLectura[] = [];
  if (!cicloActual) {
    campos.push({
      etiqueta: 'Testigo de avería (MIL)',
      valor:
        typeof datos.milEncendida === 'boolean'
          ? datos.milEncendida
            ? 'Encendido'
            : 'Apagado'
          : SIN_DATO,
    });
    campos.push({
      etiqueta: 'Cantidad de DTC declarada',
      valor: magnitud(datos.cantidadDtc),
    });
  }
  campos.push({
    etiqueta: 'Tipo de encendido',
    valor: texto(datos.tipoEncendido) ?? SIN_DATO,
  });
  const monitores = Array.isArray(datos.monitores)
    ? datos.monitores.map(item => {
        const monitor = objeto(item);
        const habilitado =
          monitor?.[cicloActual ? 'habilitadoEsteCiclo' : 'soportado'];
        // no confundo un monitor no compatible con uno que ya termino su prueba
        const estado =
          habilitado === false
            ? cicloActual
              ? 'No habilitado en este ciclo'
              : 'No compatible'
            : habilitado !== true || typeof monitor?.completado !== 'boolean'
            ? 'Sin información'
            : monitor.completado
            ? 'Completado'
            : 'Pendiente';
        return {
          etiqueta: texto(monitor?.nombre) ?? 'Monitor sin identificar',
          valor: estado,
        };
      })
    : [];
  return { campos, monitores };
}

// preparo solo la presentacion; no vuelvo a interpretar bytes ni cambio el valor guardado
export function presentarLecturaPid(
  codigo: string,
  valor: ValorJson,
  unidad?: string | null,
): LecturaPresentada | null {
  const pid = codigo.trim().toUpperCase();
  if (PARAMETROS_INTERNOS.has(pid)) return null;
  const datos = objeto(valor);
  if (!datos) {
    const legible =
      typeof valor === 'number'
        ? magnitud(valor, unidad)
        : typeof valor === 'boolean'
        ? valor
          ? 'Sí'
          : 'No'
        : texto(valor) ??
          (valor === null
            ? SIN_DATO
            : 'Lectura guardada sin formato de presentación.');
    return { campos: [{ etiqueta: '', valor: legible }] };
  }
  if (pid === '0101' || pid === '0141')
    return presentarMonitores(datos, pid === '0141');
  if (pid === '0103') {
    return {
      campos: ['sistema1', 'sistema2'].map((clave, indice) => ({
        etiqueta: `Sistema ${indice + 1}`,
        valor: listaTexto(datos[clave]).join(' · ') || 'Sin estado informado',
      })),
      ...(texto(datos.advertencia)
        ? {
            advertencia:
              'La respuesta incluye estados reservados; no se puede interpretar por completo.',
          }
        : {}),
    };
  }
  if (pid === '0113' || pid === '011D') {
    const presentes = listaTexto(datos.sensoresPresentes);
    return {
      campos: [
        {
          etiqueta: 'Sensores declarados como presentes',
          valor: presentes.join('\n') || 'Sin sensores informados',
        },
      ],
    };
  }
  const numeroPid = Number.parseInt(pid.slice(2), 16);
  if (
    /^01[0-9A-F]{2}$/.test(pid) &&
    ((numeroPid >= 0x14 && numeroPid <= 0x1b) ||
      (numeroPid >= 0x24 && numeroPid <= 0x2b) ||
      (numeroPid >= 0x34 && numeroPid <= 0x3b))
  ) {
    const campos: CampoLectura[] = [
      { etiqueta: 'Ubicación', valor: texto(datos.sensor) ?? SIN_DATO },
    ];
    if (numeroPid >= 0x24)
      campos.push({ etiqueta: 'Lambda', valor: magnitud(datos.lambda) });
    if (numeroPid >= 0x34)
      campos.push({
        etiqueta: 'Corriente',
        valor: magnitud(datos.corriente, texto(datos.unidadCorriente) ?? 'mA'),
      });
    else
      campos.push({
        etiqueta: 'Voltaje',
        valor: magnitud(datos.voltaje, texto(datos.unidadVoltaje) ?? 'V'),
      });
    if (numeroPid <= 0x1b)
      campos.push({
        etiqueta: 'Ajuste de combustible',
        valor: magnitud(
          datos.ajusteCombustible,
          texto(datos.unidadAjuste) ?? '%',
        ),
      });
    return { campos };
  }
  if (AJUSTES_POR_BANCO.has(pid)) {
    const campos = [1, 2, 3, 4]
      .filter(banco =>
        Object.prototype.hasOwnProperty.call(datos, `banco${banco}`),
      )
      .map(banco => ({
        etiqueta: `Banco ${banco}`,
        valor: magnitud(datos[`banco${banco}`], texto(datos.unidad) ?? '%'),
      }));
    if (campos.length) return { campos };
  }
  if (pid === '0102')
    return {
      campos: [
        {
          etiqueta: 'DTC asociado al cuadro congelado',
          valor:
            texto(datos.codigoDtc) ??
            (datos.cuadroCongeladoDisponible === false
              ? 'Sin DTC asociado'
              : SIN_DATO),
        },
      ],
    };
  if (pid === '0112' || pid === '0151' || pid === '015F')
    return {
      campos: [{ etiqueta: '', valor: texto(datos.descripcion) ?? SIN_DATO }],
    };
  if (pid === '011E')
    return {
      campos: [
        {
          etiqueta: 'Toma de fuerza',
          valor:
            typeof datos.tomaDeFuerzaActiva === 'boolean'
              ? datos.tomaDeFuerzaActiva
                ? 'Activa'
                : 'Inactiva'
              : SIN_DATO,
        },
      ],
    };
  // si llega una estructura nueva, prefiero avisarlo antes que volver a mostrar json
  return {
    campos: [
      { etiqueta: '', valor: 'Lectura guardada sin formato de presentación.' },
    ],
  };
}

export function LecturasSnapshot({
  lecturas,
  catalogo,
}: {
  lecturas: readonly NuevoValorPidSnapshot[];
  catalogo: readonly CatalogoPid[];
}) {
  const [abiertas, establecerAbiertas] = useState(false);
  const definiciones = new Map(
    catalogo.map(item => [item.codigo.toUpperCase(), item]),
  );
  const visibles = lecturas.flatMap((lectura, indice) => {
    const definicion = definiciones.get(lectura.pidCodigo.toUpperCase());
    const presentacion = presentarLecturaPid(
      lectura.pidCodigo,
      lectura.valor,
      definicion?.unidad,
    );
    return presentacion
      ? [
          {
            clave: `${lectura.pidCodigo}:${indice}`,
            titulo: definicion?.nombre ?? lectura.pidCodigo,
            presentacion,
          },
        ]
      : [];
  });
  if (!lecturas.length) return null;
  if (!visibles.length)
    return (
      <Text style={estilos.secundario}>
        Solo hay parámetros internos de configuración guardados.
      </Text>
    );
  return (
    <View style={estilos.contenedor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          abiertas ? 'Ocultar lecturas' : 'Ver lecturas del escaneo'
        }
        accessibilityState={{ expanded: abiertas }}
        onPress={() => establecerAbiertas(actual => !actual)}
        style={({ pressed }) => [estilos.boton, pressed && estilos.presionado]}
      >
        <Text style={estilos.textoBoton}>
          {abiertas ? 'Ocultar lecturas' : 'Ver lecturas del escaneo'}
        </Text>
        <Text accessible={false} style={estilos.flecha}>
          {abiertas ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      {abiertas
        ? visibles.map(lectura => (
            <DetalleLectura
              key={lectura.clave}
              titulo={lectura.titulo}
              presentacion={lectura.presentacion}
            />
          ))
        : null}
    </View>
  );
}

function DetalleLectura({
  titulo,
  presentacion,
}: {
  titulo: string;
  presentacion: LecturaPresentada;
}) {
  const [verMonitores, establecerVerMonitores] = useState(false);
  return (
    <View style={estilos.lectura}>
      <Text style={estilos.titulo}>{titulo}</Text>
      {presentacion.campos.map((campo, indice) => (
        <Campo key={`${campo.etiqueta}:${indice}`} campo={campo} />
      ))}
      {presentacion.advertencia ? (
        <Text style={estilos.advertencia}>{presentacion.advertencia}</Text>
      ) : null}
      {presentacion.monitores ? (
        presentacion.monitores.length ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${
                verMonitores ? 'Ocultar' : 'Ver'
              } monitores: ${titulo}`}
              accessibilityState={{ expanded: verMonitores }}
              onPress={() => establecerVerMonitores(actual => !actual)}
              style={({ pressed }) => [
                estilos.botonMonitores,
                pressed && estilos.presionado,
              ]}
            >
              <Text style={estilos.textoBoton}>
                {verMonitores ? 'Ocultar monitores' : 'Ver monitores'}
              </Text>
              <Text accessible={false} style={estilos.flecha}>
                {verMonitores ? '⌃' : '⌄'}
              </Text>
            </Pressable>
            {verMonitores ? (
              <View style={estilos.monitores}>
                {presentacion.monitores.map((campo, indice) => (
                  <Campo key={`${campo.etiqueta}:${indice}`} campo={campo} />
                ))}
                <Text style={estilos.secundario}>
                  Completado indica que se ejecutó la prueba, no que el
                  componente esté libre de fallas.
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={estilos.secundario}>Sin información de monitores.</Text>
        )
      ) : null}
    </View>
  );
}

function Campo({ campo }: { campo: CampoLectura }) {
  return (
    <View style={estilos.campo}>
      {campo.etiqueta ? (
        <Text style={estilos.etiqueta}>{campo.etiqueta}</Text>
      ) : null}
      <Text selectable style={estilos.valor}>
        {campo.valor}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: 16 },
  boton: {
    minHeight: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#366557',
    backgroundColor: '#1D302A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  textoBoton: {
    flexShrink: 1,
    color: '#81E2C5',
    fontSize: 13,
    fontWeight: '600',
  },
  flecha: { color: '#81E2C5', fontSize: 20 },
  presionado: { opacity: 0.7 },
  lectura: {
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#303034',
  },
  titulo: { color: '#E6E6EA', fontSize: 14, fontWeight: '600', lineHeight: 21 },
  campo: { gap: 3 },
  etiqueta: { color: '#96969D', fontSize: 12 },
  valor: { color: '#E6E6EA', fontSize: 14, lineHeight: 21 },
  secundario: { color: '#96969D', fontSize: 12, lineHeight: 18 },
  advertencia: { color: '#E5C087', fontSize: 12, lineHeight: 18 },
  botonMonitores: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#3B3B40',
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 12,
  },
  monitores: { gap: 10 },
});
