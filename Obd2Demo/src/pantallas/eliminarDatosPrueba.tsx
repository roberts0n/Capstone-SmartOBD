import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { listarClientes } from '../clientes/ServicioClientes';
import { listarVehiculosCliente } from '../vehiculos/ServicioVehiculos';
import { listarCasosRecepcion } from '../casos/ServicioCasosRecepcion';
import {
  eliminarRegistroPrueba, previsualizarEliminacionPrueba,
  type ResumenEliminacionPrueba, type TipoRegistroPrueba,
} from '../servicios/limpiezaDatosPrueba';
import type { SesionTaller } from '../tipos/usuarioTaller';

interface Propiedades {
  sesion: SesionTaller;
  alVolver: () => void;
  alEliminar: () => void;
  alCambiarOperacion: (enCurso: boolean) => void;
}

interface Opcion { id: string; titulo: string; detalle: string }
const TIPOS: { tipo: TipoRegistroPrueba; titulo: string }[] = [
  { tipo: 'caso', titulo: 'Caso' },
  { tipo: 'vehiculo', titulo: 'Vehículo' },
  { tipo: 'cliente', titulo: 'Cliente' },
];
const CONTEOS: [keyof ResumenEliminacionPrueba['cantidades'], string][] = [
  ['clientes', 'Clientes'], ['vehiculos', 'Vehículos'], ['casos', 'Casos'],
  ['asignaciones', 'Asignaciones'], ['mensajes', 'Mensajes'], ['snapshots', 'Snapshots'],
  ['valoresPid', 'Lecturas PID'], ['codigosDtc', 'Registros DTC'],
];

export function EliminarDatosPrueba({ sesion, alVolver, alEliminar, alCambiarOperacion }: Propiedades) {
  const [tipo, establecerTipo] = useState<TipoRegistroPrueba>('caso');
  const [cliente, establecerCliente] = useState<Opcion | null>(null);
  const [vehiculo, establecerVehiculo] = useState<Opcion | null>(null);
  const [caso, establecerCaso] = useState<Opcion | null>(null);
  const [opciones, establecerOpciones] = useState<Opcion[]>([]);
  const [busqueda, establecerBusqueda] = useState('');
  const [cargando, establecerCargando] = useState(true);
  const [consultando, establecerConsultando] = useState(false);
  const [eliminando, establecerEliminando] = useState(false);
  const [resumen, establecerResumen] = useState<ResumenEliminacionPrueba | null>(null);
  const [confirmacion, establecerConfirmacion] = useState('');
  const [errorLista, establecerErrorLista] = useState<string | null>(null);
  const [error, establecerError] = useState<string | null>(null);
  const [mensaje, establecerMensaje] = useState<string | null>(null);
  const [recarga, establecerRecarga] = useState(0);
  const activa = useRef(true);
  const operacion = useRef(false);
  const dialogoAbierto = useRef(false);
  const version = useRef(0);
  const seleccionado = tipo === 'cliente' ? cliente : tipo === 'vehiculo' ? vehiculo : caso;
  const ocupada = consultando || eliminando;

  useEffect(() => {
    activa.current = true;
    return () => { activa.current = false; version.current += 1; };
  }, []);

  useEffect(() => {
    let vigente = true;
    establecerOpciones([]);
    establecerErrorLista(null);
    establecerCargando(true);
    async function cargar() {
      try {
        let nuevas: Opcion[] = [];
        if (!cliente) {
          nuevas = (await listarClientes()).map(item => ({
            id: item.id, titulo: item.nombre,
            detalle: [item.telefono, item.correo, item.id.slice(0, 8)].filter(Boolean).join(' · '),
          }));
        } else if (tipo !== 'cliente' && !vehiculo) {
          nuevas = (await listarVehiculosCliente(cliente.id)).map(item => ({
            id: item.id, titulo: [item.marca, item.modelo, item.patente].filter(Boolean).join(' · ') || item.id,
            detalle: item.vin ?? 'Sin VIN registrado',
          }));
        } else if (tipo === 'caso' && vehiculo && !caso) {
          nuevas = (await listarCasosRecepcion()).filter(item => item.vehiculoId === vehiculo.id).map(item => ({
            id: item.id, titulo: item.motivoIngreso,
            detalle: `${item.estado} · ${item.creadoEn.slice(0, 10)} · ${item.id.slice(0, 8)}`,
          }));
        }
        if (vigente) establecerOpciones(nuevas);
      } catch (capturado) {
        if (vigente) establecerErrorLista(mensajeError(capturado));
      } finally {
        if (vigente) establecerCargando(false);
      }
    }
    cargar().catch(() => undefined);
    return () => { vigente = false; };
  }, [tipo, cliente, vehiculo, caso, recarga]);

  function invalidar() {
    version.current += 1;
    establecerResumen(null);
    establecerConfirmacion('');
    establecerError(null);
    establecerMensaje(null);
    establecerBusqueda('');
  }

  function seleccionar(opcion: Opcion) {
    if (operacion.current) return;
    invalidar();
    if (!cliente) establecerCliente(opcion);
    else if (!vehiculo) establecerVehiculo(opcion);
    else establecerCaso(opcion);
  }

  async function consultar() {
    if (!seleccionado || operacion.current) return;
    operacion.current = true;
    const consulta = ++version.current;
    establecerConsultando(true);
    establecerResumen(null);
    establecerConfirmacion('');
    establecerError(null);
    try {
      const resultado = await previsualizarEliminacionPrueba(tipo, seleccionado.id, sesion);
      if (activa.current && consulta === version.current) establecerResumen(resultado);
    } catch (capturado) {
      if (activa.current && consulta === version.current) establecerError(mensajeError(capturado));
    } finally {
      operacion.current = false;
      if (activa.current) establecerConsultando(false);
    }
  }

  async function eliminar(revisado: ResumenEliminacionPrueba, revision: number) {
    dialogoAbierto.current = false;
    if (!activa.current || revision !== version.current || operacion.current) return;
    operacion.current = true;
    establecerEliminando(true);
    alCambiarOperacion(true);
    establecerError(null);
    try {
      await eliminarRegistroPrueba(revisado, 'ELIMINAR', sesion);
      if (!activa.current) return;
      invalidar();
      establecerCliente(null);
      establecerVehiculo(null);
      establecerCaso(null);
      establecerRecarga(actual => actual + 1);
      establecerMensaje('Registro y datos asociados eliminados.');
      alEliminar();
    } catch (capturado) {
      // si la red falla, vuelvo a consultar antes de permitir otro intento
      if (activa.current) {
        invalidar();
        establecerError(mensajeError(capturado));
      }
    } finally {
      operacion.current = false;
      alCambiarOperacion(false);
      if (activa.current) establecerEliminando(false);
    }
  }

  function confirmar() {
    if (!resumen || confirmacion !== 'ELIMINAR' || operacion.current || dialogoAbierto.current) return;
    dialogoAbierto.current = true;
    const revision = version.current;
    Alert.alert('Eliminar definitivamente', `${resumen.etiqueta}\n\nSe eliminará este registro y los datos indicados. No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel', onPress: () => { dialogoAbierto.current = false; } },
      { text: 'Eliminar', style: 'destructive', onPress: () => { eliminar(resumen, revision).catch(() => undefined); } },
    ], { cancelable: true, onDismiss: () => { dialogoAbierto.current = false; } });
  }

  const coincidencias = opciones.filter(item =>
    `${item.titulo} ${item.detalle}`.toLowerCase().includes(busqueda.trim().toLowerCase()));
  const etapa = !cliente ? 'Cliente' : !vehiculo ? 'Vehículo' : 'Caso';

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <View style={estilos.cabecera}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" disabled={ocupada}
          onPress={() => { if (!operacion.current) alVolver(); }} style={estilos.volver}>
          <Text style={estilos.flecha}>‹</Text>
        </Pressable>
        <Text style={estilos.titulo}>Eliminar datos de prueba</Text>
      </View>
      <Text style={estilos.advertencia}>Elige solo registros de prueba. La eliminación es definitiva.</Text>
      <View style={estilos.fila}>
        {TIPOS.map(item => (
          <Pressable key={item.tipo} accessibilityRole="radio" accessibilityState={{ checked: tipo === item.tipo }}
            disabled={ocupada} style={[estilos.tipo, tipo === item.tipo && estilos.seleccionado]}
            onPress={() => {
              if (operacion.current) return;
              invalidar(); establecerTipo(item.tipo); establecerVehiculo(null); establecerCaso(null);
            }}><Text style={estilos.texto}>{item.titulo}</Text></Pressable>
        ))}
      </View>
      {([['cliente', cliente], ['vehiculo', vehiculo], ['caso', caso]] as const).map(([clave, opcion]) => opcion && (
        <View key={clave} style={estilos.tarjeta}>
          <Text style={estilos.texto}>{opcion.titulo}</Text>
          <Text style={estilos.secundario}>{opcion.detalle}</Text>
          <Pressable accessibilityRole="button" disabled={ocupada} onPress={() => {
            if (operacion.current) return;
            invalidar();
            if (clave === 'cliente') establecerCliente(null);
            if (clave !== 'caso') establecerVehiculo(null);
            establecerCaso(null);
          }}><Text style={estilos.enlace}>{`Cambiar ${clave === 'vehiculo' ? 'vehículo' : clave}`}</Text></Pressable>
        </View>
      ))}
      {!seleccionado && (
        <View style={estilos.lista}>
          <Text style={estilos.texto}>{etapa}</Text>
          <TextInput accessibilityLabel={`Buscar ${etapa.toLowerCase()}`} style={estilos.entrada} value={busqueda}
            onChangeText={establecerBusqueda} editable={!ocupada} placeholder="Buscar" placeholderTextColor="#71717A" />
          {cargando ? <ActivityIndicator color="#13C296" /> : errorLista ? (
            <>
              <Text accessibilityRole="alert" style={estilos.error}>{errorLista}</Text>
              <Pressable accessibilityRole="button" disabled={ocupada} onPress={() => establecerRecarga(actual => actual + 1)}>
                <Text style={estilos.enlace}>Reintentar listado</Text>
              </Pressable>
            </>
          ) : coincidencias.length === 0 ? <Text style={estilos.secundario}>No hay registros para seleccionar.</Text> : coincidencias.slice(0, 8).map(opcion => (
            <Pressable key={opcion.id} accessibilityRole="button" disabled={ocupada} onPress={() => seleccionar(opcion)} style={estilos.tarjeta}>
              <Text style={estilos.texto}>{opcion.titulo}</Text>
              <Text style={estilos.secundario}>{opcion.detalle}</Text>
            </Pressable>
          ))}
          {coincidencias.length > 8 && <Text style={estilos.secundario}>Afina la búsqueda para ver otros registros.</Text>}
        </View>
      )}
      {seleccionado && !resumen && (
        <Pressable accessibilityRole="button" disabled={ocupada} onPress={consultar} style={estilos.boton}>
          <Text style={estilos.textoBoton}>{consultando ? 'Consultando...' : 'Ver qué se eliminará'}</Text>
        </Pressable>
      )}
      {resumen && (
        <View style={estilos.tarjeta}>
          <Text style={estilos.texto}>Se eliminará</Text>
          {CONTEOS.map(([clave, titulo]) => (
            <View style={estilos.conteo} key={clave}><Text style={estilos.secundario}>{titulo}</Text>
              <Text style={estilos.texto}>{resumen.cantidades[clave]}</Text></View>
          ))}
          <Text style={estilos.secundario}>Cuentas y catálogo PID se conservan.</Text>
          <TextInput accessibilityLabel="Confirmación de eliminación" style={estilos.entrada} value={confirmacion}
            onChangeText={establecerConfirmacion} editable={!ocupada} autoCorrect={false} autoCapitalize="characters"
            placeholder="Escribe ELIMINAR" placeholderTextColor="#71717A" />
          <Pressable accessibilityRole="button" disabled={ocupada || confirmacion !== 'ELIMINAR'} onPress={confirmar}
            style={[estilos.botonEliminar, (ocupada || confirmacion !== 'ELIMINAR') && estilos.deshabilitado]}>
            <Text style={estilos.textoBoton}>{eliminando ? 'Eliminando...' : 'Eliminar definitivamente'}</Text>
          </Pressable>
        </View>
      )}
      {error && <Text accessibilityRole="alert" style={estilos.error}>{error}</Text>}
      {mensaje && <Text accessibilityRole="alert" style={estilos.exito}>{mensaje}</Text>}
    </ScrollView>
  );
}

function mensajeError(capturado: unknown) {
  return capturado instanceof Error ? capturado.message : 'No se pudo completar la operación.';
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { padding: 20, paddingBottom: 36, gap: 14 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  volver: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#171719', alignItems: 'center', justifyContent: 'center' },
  flecha: { color: '#E8E8EA', fontSize: 30 },
  titulo: { flex: 1, color: '#F4F4F5', fontSize: 21, fontWeight: '700' },
  advertencia: { color: '#E6B85C', fontSize: 12, lineHeight: 18 },
  fila: { flexDirection: 'row', gap: 8 },
  tipo: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#303034' },
  seleccionado: { backgroundColor: '#153B32', borderColor: '#10A37F' },
  tarjeta: { padding: 15, backgroundColor: '#171719', borderRadius: 15, borderWidth: 1, borderColor: '#303034', gap: 8 },
  texto: { color: '#F0F0F2', fontSize: 14, fontWeight: '600' },
  secundario: { color: '#96969D', fontSize: 12, lineHeight: 18 },
  enlace: { color: '#4DDBB7', fontSize: 12, paddingVertical: 6 },
  lista: { gap: 10 },
  entrada: { borderWidth: 1, borderColor: '#38383D', borderRadius: 12, padding: 12, color: '#F4F4F5', backgroundColor: '#101012' },
  boton: { backgroundColor: '#10A37F', padding: 15, borderRadius: 12, alignItems: 'center' },
  botonEliminar: { backgroundColor: '#A63737', padding: 15, borderRadius: 12, alignItems: 'center' },
  textoBoton: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  deshabilitado: { opacity: 0.4 },
  conteo: { flexDirection: 'row', justifyContent: 'space-between' },
  error: { color: '#FF9C94', fontSize: 12, lineHeight: 18 },
  exito: { color: '#66DFBD', fontSize: 13 },
});
