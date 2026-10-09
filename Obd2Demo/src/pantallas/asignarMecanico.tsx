import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  asignarMecanicoCaso,
  ErrorRecargaAsignacion,
  listarMecanicosActivos,
} from '../casos/ServicioAsignaciones';
import {
  obtenerCasoRecepcion,
  type CasoRecepcion,
} from '../casos/ServicioCasosRecepcion';
import type { MecanicoAsignable } from '../casos/TiposAsignacion';
import type { SesionTaller } from '../tipos/usuarioTaller';
import { useProteccionSalida } from '../componentes/ProteccionSalida';

interface Propiedades {
  sesion: SesionTaller;
  caso: CasoRecepcion;
  alVolver: () => void;
  alCompletar: (caso: CasoRecepcion) => void;
}

export function AsignarMecanico({
  sesion,
  caso,
  alVolver,
  alCompletar,
}: Propiedades) {
  const [mecanicos, establecerMecanicos] = useState<MecanicoAsignable[]>([]);
  const [seleccionado, establecerSeleccionado] = useState<string | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [asignando, establecerAsignando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const [guardada, establecerGuardada] = useState(false);
  const [intentoCarga, establecerIntentoCarga] = useState(0);
  const operacionEnCurso = useRef(false);
  const asignacionGuardada = useRef(false);
  const pantallaActiva = useRef(true);
  const solicitarSalida = useProteccionSalida({
    ocupado: asignando,
    cambios: !guardada && Boolean(seleccionado),
  });
  const puedeAsignar =
    sesion.perfil === 'recepcion' &&
    caso.recepcionResponsableId === sesion.usuarioId &&
    !caso.mecanico &&
    (caso.estado === 'ingresado' || caso.estado === 'diagnostico_inicial');

  useEffect(() => {
    let activa = true;
    pantallaActiva.current = true;
    establecerCargando(true);
    establecerError(null);
    listarMecanicosActivos()
      .then(resultado => {
        if (activa) establecerMecanicos(resultado);
      })
      .catch(capturado => {
        if (activa) {
          establecerError(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudieron cargar los mecánicos.',
          );
        }
      })
      .finally(() => {
        if (activa) establecerCargando(false);
      });
    return () => {
      activa = false;
      pantallaActiva.current = false;
    };
  }, [intentoCarga]);

  async function recargarCaso() {
    const actualizado = await obtenerCasoRecepcion(caso.id);
    if (
      !actualizado ||
      !actualizado.mecanico ||
      actualizado.estado === 'ingresado' ||
      actualizado.estado === 'diagnostico_inicial'
    ) {
      throw new Error(
        'La asignación se guardó, pero no se pudo recuperar el caso actualizado. Reintenta la consulta.',
      );
    }
    if (pantallaActiva.current) alCompletar(actualizado);
  }

  async function asignar() {
    if (operacionEnCurso.current) return;
    if (!asignacionGuardada.current && !puedeAsignar) return;
    if (!asignacionGuardada.current && !seleccionado) {
      establecerError('Selecciona un mecánico para continuar.');
      return;
    }
    establecerError(null);
    // bloqueo la segunda pulsacion sin esperar al siguiente render
    operacionEnCurso.current = true;
    establecerAsignando(true);
    try {
      if (!asignacionGuardada.current) {
        try {
          await asignarMecanicoCaso(
            {
              casoId: caso.id,
              mecanicoId: seleccionado!,
              prioridad: caso.prioridad,
            },
            sesion,
          );
        } catch (capturado) {
          if (!(capturado instanceof ErrorRecargaAsignacion)) throw capturado;
        }
        asignacionGuardada.current = true;
        if (pantallaActiva.current) establecerGuardada(true);
      }
      // leo el nombre y el estado desde la bd, no los doy por guardados en la pantalla
      await recargarCaso();
    } catch (capturado) {
      if (pantallaActiva.current)
        establecerError(
          capturado instanceof Error
            ? capturado.message
            : 'No se pudo asignar el mecánico.',
        );
    } finally {
      operacionEnCurso.current = false;
      if (pantallaActiva.current) establecerAsignando(false);
    }
  }

  const codigoOrden = `OT-${caso.id.slice(0, 8).toUpperCase()}`;

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
    >
      <View style={estilos.cabecera}>
        <Pressable
          accessibilityLabel="Volver"
          accessibilityRole="button"
          disabled={asignando}
          onPress={() => solicitarSalida(alVolver)}
          style={[estilos.volver, asignando && estilos.deshabilitado]}
        >
          <Text style={estilos.flechaVolver}>‹</Text>
        </Pressable>
        <View>
          <Text style={estilos.seccion}>Recepción</Text>
          <Text style={estilos.titulo}>Asignar mecánico</Text>
        </View>
      </View>

      <View style={estilos.resumen}>
        <View style={estilos.filaOrden}>
          <Text style={estilos.codigoOrden}>{codigoOrden}</Text>
          <Text style={estilos.estado}>
            {guardada
              ? 'Asignado'
              : caso.estado === 'diagnostico_inicial'
              ? 'Diagnóstico inicial'
              : 'Ingresado'}
          </Text>
        </View>
        <Resumen etiqueta="Cliente" valor={caso.cliente} />
        <Resumen
          etiqueta="Vehículo"
          valor={`${caso.vehiculo}  •  ${caso.patente}`}
        />
        <Resumen
          etiqueta="Motivo de ingreso"
          valor={caso.motivoIngreso}
          secundario
        />
      </View>

      <Text style={estilos.etiquetaLista}>Mecánicos activos</Text>
      {cargando ? (
        <ActivityIndicator color="#13C296" style={estilos.cargando} />
      ) : mecanicos.length === 0 ? (
        <Text style={estilos.sinMecanicos}>
          No hay mecánicos activos para asignar.
        </Text>
      ) : (
        <View style={estilos.lista}>
          {mecanicos.map(mecanico => {
            const activo = seleccionado === mecanico.id;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: activo }}
                disabled={asignando || guardada || !puedeAsignar}
                key={mecanico.id}
                onPress={() => establecerSeleccionado(mecanico.id)}
                style={[estilos.mecanico, activo && estilos.mecanicoActivo]}
              >
                <View style={[estilos.avatar, activo && estilos.avatarActivo]}>
                  <Text
                    style={[
                      estilos.iniciales,
                      activo && estilos.inicialesActivas,
                    ]}
                  >
                    {obtenerIniciales(mecanico.nombre)}
                  </Text>
                </View>
                <View style={estilos.datosMecanico}>
                  <Text style={estilos.nombreMecanico}>{mecanico.nombre}</Text>
                  <Text
                    style={[
                      estilos.especialidad,
                      activo && estilos.especialidadActiva,
                    ]}
                  >
                    {mecanico.especialidad || 'Mecánica general'}
                  </Text>
                </View>
                <View style={[estilos.radio, activo && estilos.radioActivo]}>
                  {activo ? <View style={estilos.centroRadio} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {error ? (
        <Text accessibilityRole="alert" style={estilos.error}>
          {error}
        </Text>
      ) : null}
      {!puedeAsignar && !guardada ? (
        <Text style={estilos.error}>
          El caso ya fue asignado o no pertenece a esta recepción.
        </Text>
      ) : null}
      {!cargando && error && mecanicos.length === 0 && !guardada ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => establecerIntentoCarga(valor => valor + 1)}
          style={estilos.boton}
        >
          <Text style={estilos.textoBoton}>Recargar mecánicos</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={
          asignando ||
          (!guardada && (cargando || mecanicos.length === 0 || !puedeAsignar))
        }
        onPress={asignar}
        style={({ pressed }) => [
          estilos.boton,
          pressed && estilos.presionado,
          (asignando ||
            (!guardada &&
              (cargando || mecanicos.length === 0 || !puedeAsignar))) &&
            estilos.deshabilitado,
        ]}
      >
        {asignando ? <ActivityIndicator color="#061B15" size="small" /> : null}
        <Text style={estilos.textoBoton}>
          {asignando
            ? 'Procesando...'
            : guardada
            ? 'Reintentar consulta'
            : 'Asignar mecánico'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Resumen({
  etiqueta,
  valor,
  secundario = false,
}: {
  etiqueta: string;
  valor: string;
  secundario?: boolean;
}) {
  return (
    <View style={estilos.datoResumen}>
      <Text style={estilos.etiquetaResumen}>{etiqueta}</Text>
      <Text
        style={[estilos.valorResumen, secundario && estilos.valorSecundario]}
      >
        {valor}
      </Text>
    </View>
  );
}

function obtenerIniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(parte => parte.charAt(0).toUpperCase())
    .join('');
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
  seccion: {
    color: '#13C296',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  titulo: { color: '#F4F4F5', fontSize: 23, fontWeight: '700' },
  resumen: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 17,
    padding: 15,
  },
  filaOrden: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  codigoOrden: {
    color: '#13C296',
    backgroundColor: '#10372D',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '800',
  },
  estado: { color: '#888890', fontSize: 11 },
  datoResumen: { marginTop: 10 },
  etiquetaResumen: {
    color: '#888890',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
  },
  valorResumen: { color: '#F0F0F2', fontSize: 14, fontWeight: '700' },
  valorSecundario: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  etiquetaLista: {
    color: '#929299',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 25,
    marginBottom: 11,
  },
  cargando: { marginVertical: 26 },
  sinMecanicos: { color: '#8C8C94', fontSize: 13, paddingVertical: 20 },
  lista: { gap: 10 },
  mecanico: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 12,
  },
  mecanicoActivo: { backgroundColor: '#10251F', borderColor: '#13C296' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28282C',
  },
  avatarActivo: { backgroundColor: '#13C296' },
  iniciales: { color: '#9A9AA1', fontSize: 12, fontWeight: '800' },
  inicialesActivas: { color: '#061B15' },
  datosMecanico: { flex: 1, marginHorizontal: 12 },
  nombreMecanico: { color: '#F1F1F3', fontSize: 14, fontWeight: '700' },
  especialidad: { color: '#898990', fontSize: 11, marginTop: 4 },
  especialidadActiva: { color: '#21CFA3' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#36363B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActivo: { borderColor: '#13C296' },
  centroRadio: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#13C296',
  },
  error: { color: '#FF9C94', fontSize: 12, lineHeight: 18, marginTop: 14 },
  boton: {
    minHeight: 52,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13C296',
    borderRadius: 13,
    marginTop: 22,
  },
  textoBoton: { color: '#061B15', fontSize: 14, fontWeight: '800' },
  presionado: { opacity: 0.78 },
  deshabilitado: { opacity: 0.5 },
});

export default AsignarMecanico;
