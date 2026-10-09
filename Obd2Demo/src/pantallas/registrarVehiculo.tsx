import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useBusquedaClientes } from '../clientes/usarBusquedaClientes';
import type { ClienteTaller } from '../clientes/TiposCliente';
import type { SesionTaller } from '../tipos/usuarioTaller';
import { useProteccionSalida } from '../componentes/ProteccionSalida';
import {
  crearVehiculo,
  actualizarVehiculo,
  normalizarPatente,
} from '../vehiculos/ServicioVehiculos';
import type {
  TipoCombustible,
  VehiculoTaller,
} from '../vehiculos/TiposVehiculo';

interface Propiedades {
  sesion: SesionTaller;
  clienteInicialId?: string | null;
  alFinalizar: () => void;
  alVolver: () => void;
  alVehiculoRegistrado?: (vehiculo: VehiculoTaller) => void;
  etiquetaFinalizar?: string;
  vehiculoEditar?: VehiculoTaller;
  alGuardarEdicion?: (vehiculo: VehiculoTaller) => void;
}

export function RegistrarVehiculo({
  sesion,
  clienteInicialId,
  alFinalizar,
  alVolver,
  alVehiculoRegistrado,
  etiquetaFinalizar = 'Finalizar',
  vehiculoEditar,
  alGuardarEdicion,
}: Propiedades) {
  const [cliente, establecerCliente] = useState<ClienteTaller | null>(null);
  const [busqueda, establecerBusqueda] = useState('');
  const [patente, establecerPatente] = useState(vehiculoEditar?.patente ?? '');
  const [marca, establecerMarca] = useState(vehiculoEditar?.marca ?? '');
  const [modelo, establecerModelo] = useState(vehiculoEditar?.modelo ?? '');
  const [anio, establecerAnio] = useState(
    vehiculoEditar?.anio?.toString() ?? '',
  );
  const [combustible, establecerCombustible] = useState<TipoCombustible | null>(
    vehiculoEditar?.combustible === 'gasolina' ||
      vehiculoEditar?.combustible === 'diesel'
      ? vehiculoEditar.combustible
      : null,
  );
  const [antecedentes, establecerAntecedentes] = useState(
    vehiculoEditar?.antecedentesVehiculo ?? '',
  );
  const [guardando, establecerGuardando] = useState(false);
  const [vehiculoCreado, establecerVehiculoCreado] = useState<string | null>(
    null,
  );
  const [error, establecerError] = useState<string | null>(null);
  const operacionEnCurso = useRef(false);
  const pantallaActiva = useRef(true);
  const busquedaClientes = useBusquedaClientes(
    busqueda,
    clienteInicialId ?? cliente?.id,
  );
  const { clientes, cargando: cargandoClientes } = busquedaClientes;
  const solicitarSalida = useProteccionSalida({
    ocupado: guardando,
    cambios:
      !vehiculoCreado &&
      (patente !== (vehiculoEditar?.patente ?? '') ||
        marca !== (vehiculoEditar?.marca ?? '') ||
        modelo !== (vehiculoEditar?.modelo ?? '') ||
        anio !== (vehiculoEditar?.anio?.toString() ?? '') ||
        combustible !== (vehiculoEditar?.combustible ?? null) ||
        antecedentes !== (vehiculoEditar?.antecedentesVehiculo ?? '')),
  });

  useEffect(() => {
    pantallaActiva.current = true;
    return () => {
      pantallaActiva.current = false;
    };
  }, []);

  useEffect(() => {
    if (clienteInicialId && busquedaClientes.seleccionado)
      establecerCliente(busquedaClientes.seleccionado);
  }, [clienteInicialId, busquedaClientes.seleccionado]);
  const coincidencias = cliente ? [] : clientes;

  function seleccionarCliente(seleccionado: ClienteTaller) {
    establecerCliente(seleccionado);
    establecerBusqueda(seleccionado.nombre);
    establecerError(null);
  }

  function cambiarCliente() {
    establecerCliente(null);
    establecerBusqueda('');
  }

  async function registrar() {
    if (
      operacionEnCurso.current ||
      vehiculoCreado ||
      cargandoClientes ||
      busquedaClientes.error
    )
      return;
    if (!cliente) {
      establecerError('Selecciona el cliente dueño del vehículo.');
      return;
    }
    if (!patente.trim() || !marca.trim() || !modelo.trim()) {
      establecerError('Completa la patente, marca y modelo del vehículo.');
      return;
    }
    const anioNumero = Number(anio);
    if (
      !Number.isInteger(anioNumero) ||
      anioNumero < 1886 ||
      anioNumero > 2200
    ) {
      establecerError('Ingresa un año válido.');
      return;
    }
    if (!combustible) {
      establecerError('Selecciona gasolina o diesel.');
      return;
    }

    let patenteNormalizada: string;
    try {
      patenteNormalizada = normalizarPatente(patente);
    } catch (capturado) {
      establecerError((capturado as Error).message);
      return;
    }

    establecerError(null);
    operacionEnCurso.current = true;
    establecerGuardando(true);
    try {
      const entrada = {
        patente: patenteNormalizada,
        marca,
        modelo,
        anio: anioNumero,
        combustible,
        antecedentesVehiculo: antecedentes || null,
      };
      const vehiculo = vehiculoEditar
        ? await actualizarVehiculo(vehiculoEditar.id, entrada, sesion)
        : await crearVehiculo(
            {
              clienteId: cliente.id,
              patente: patenteNormalizada,
              marca,
              modelo,
              anio: anioNumero,
              combustible,
              antecedentesVehiculo: antecedentes || null,
            },
            sesion,
          );
      if (!pantallaActiva.current) return;
      if (vehiculoEditar) {
        alGuardarEdicion?.(vehiculo);
        return;
      }
      establecerVehiculoCreado(
        [vehiculo.marca, vehiculo.modelo, vehiculo.patente]
          .filter(Boolean)
          .join(' · '),
      );
      alVehiculoRegistrado?.(vehiculo);
    } catch (capturado) {
      if (pantallaActiva.current)
        establecerError(
          capturado instanceof Error
            ? capturado.message
            : 'No se pudo registrar el vehículo.',
        );
    } finally {
      operacionEnCurso.current = false;
      if (pantallaActiva.current) establecerGuardando(false);
    }
  }

  function registrarOtro() {
    establecerPatente('');
    establecerMarca('');
    establecerModelo('');
    establecerAnio('');
    establecerCombustible(null);
    establecerAntecedentes('');
    establecerVehiculoCreado(null);
    establecerError(null);
  }

  if (vehiculoCreado) {
    return (
      <View style={estilos.pantalla}>
        <View style={estilos.contenidoConfirmacion}>
          <Cabecera alVolver={alFinalizar} />
          <View style={estilos.confirmacion}>
            <Text style={estilos.tituloConfirmacion}>Vehículo registrado</Text>
            <Text style={estilos.nombreConfirmacion}>{vehiculoCreado}</Text>
            <Text style={estilos.clienteConfirmacion}>{cliente?.nombre}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={registrarOtro}
            style={({ pressed }) => [
              estilos.boton,
              pressed && estilos.presionado,
            ]}
          >
            <Text style={estilos.textoBoton}>Registrar otro vehículo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={alFinalizar}
            style={({ pressed }) => [
              estilos.botonSecundario,
              pressed && estilos.presionado,
            ]}
          >
            <Text style={estilos.textoBotonSecundario}>
              {etiquetaFinalizar}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.pantalla}
    >
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        <Cabecera
          alVolver={() => solicitarSalida(alVolver)}
          titulo={vehiculoEditar ? 'Editar vehículo' : 'Registrar vehículo'}
        />

        <Text style={estilos.etiqueta}>Cliente</Text>
        {cliente ? (
          <View style={estilos.clienteSeleccionado}>
            <View style={estilos.datosCliente}>
              <Text style={estilos.nombreCliente}>{cliente.nombre}</Text>
              <Text style={estilos.contactoCliente}>
                {cliente.telefono || cliente.correo || 'Sin datos de contacto'}
              </Text>
            </View>
            {!clienteInicialId ? (
              <Pressable
                accessibilityRole="button"
                disabled={guardando}
                onPress={cambiarCliente}
              >
                <Text style={estilos.cambiarCliente}>Cambiar</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <View style={estilos.buscador}>
              <TextInput
                accessibilityLabel="Buscar cliente"
                editable={!guardando}
                maxLength={120}
                onChangeText={establecerBusqueda}
                placeholder="Buscar por nombre, correo o teléfono"
                placeholderTextColor="#77777F"
                style={estilos.entradaBuscador}
                value={busqueda}
              />
              {cargandoClientes ? (
                <ActivityIndicator color="#13C296" size="small" />
              ) : null}
            </View>
            {!cargandoClientes && coincidencias.length > 0 ? (
              <View style={estilos.resultados}>
                {coincidencias.map(item => (
                  <Pressable
                    accessibilityRole="button"
                    key={item.id}
                    disabled={guardando}
                    onPress={() => seleccionarCliente(item)}
                    style={({ pressed }) => [
                      estilos.resultadoCliente,
                      pressed && estilos.presionado,
                    ]}
                  >
                    <Text style={estilos.nombreResultado}>{item.nombre}</Text>
                    <Text style={estilos.contactoResultado}>
                      {item.telefono || item.correo || 'Sin datos de contacto'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {!cargandoClientes && clientes.length === 0 ? (
              <Text style={estilos.sinResultados}>
                Todavía no hay clientes registrados.
              </Text>
            ) : null}
            {!cargandoClientes &&
            clientes.length > 0 &&
            coincidencias.length === 0 ? (
              <Text style={estilos.sinResultados}>
                No encontramos un cliente con esos datos.
              </Text>
            ) : null}
          </>
        )}

        <View style={estilos.separador} />
        {!cliente && !cargandoClientes && !busquedaClientes.error ? (
          <View style={estilos.fila}>
            {busquedaClientes.pagina > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  busquedaClientes.establecerPagina(actual => actual - 1)
                }
              >
                <Text style={estilos.cambiarCliente}>Anteriores</Text>
              </Pressable>
            ) : null}
            {busquedaClientes.haySiguiente ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  busquedaClientes.establecerPagina(actual => actual + 1)
                }
              >
                <Text style={estilos.cambiarCliente}>Más clientes</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {busquedaClientes.error ? (
          <>
            <Text accessibilityRole="alert" style={estilos.error}>
              {busquedaClientes.error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={busquedaClientes.reintentar}
            >
              <Text style={estilos.cambiarCliente}>Reintentar consulta</Text>
            </Pressable>
          </>
        ) : null}

        <View style={estilos.fila}>
          <Campo
            etiqueta="Patente"
            deshabilitado={guardando}
            valor={patente}
            alCambiar={texto =>
              establecerPatente(
                texto.replace(/[a-z]/g, letra => letra.toUpperCase()),
              )
            }
            placeholder="BCDF12 / AB1234"
            mitad
            mayusculas
          />
          <Campo
            etiqueta="Año"
            deshabilitado={guardando}
            valor={anio}
            alCambiar={establecerAnio}
            placeholder="2021"
            teclado="number-pad"
            mitad
          />
        </View>
        <View style={estilos.fila}>
          <Campo
            etiqueta="Marca"
            deshabilitado={guardando}
            valor={marca}
            alCambiar={establecerMarca}
            placeholder="Toyota"
            mitad
          />
          <Campo
            etiqueta="Modelo"
            deshabilitado={guardando}
            valor={modelo}
            alCambiar={establecerModelo}
            placeholder="Hilux"
            mitad
          />
        </View>

        <Text style={estilos.etiqueta}>Combustible</Text>
        <View style={estilos.opcionesCombustible}>
          {(['gasolina', 'diesel'] as const).map(opcion => {
            const activa = combustible === opcion;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: activa }}
                key={opcion}
                disabled={guardando}
                onPress={() => establecerCombustible(opcion)}
                style={[
                  estilos.combustible,
                  activa && estilos.combustibleActivo,
                ]}
              >
                <Text
                  style={[
                    estilos.textoCombustible,
                    activa && estilos.textoCombustibleActivo,
                  ]}
                >
                  {opcion === 'gasolina' ? 'Gasolina' : 'Diesel'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={estilos.etiqueta}>Antecedentes (opcional)</Text>
        <TextInput
          accessibilityLabel="Antecedentes"
          editable={!guardando}
          multiline
          onChangeText={establecerAntecedentes}
          placeholder="Información útil informada por el cliente"
          placeholderTextColor="#77777F"
          style={estilos.areaTexto}
          textAlignVertical="top"
          value={antecedentes}
        />

        {error ? (
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={guardando || cargandoClientes}
          onPress={registrar}
          style={({ pressed }) => [
            estilos.boton,
            pressed && estilos.presionado,
            (guardando || cargandoClientes) && estilos.deshabilitado,
          ]}
        >
          {guardando ? (
            <ActivityIndicator color="#061B15" size="small" />
          ) : null}
          <Text style={estilos.textoBoton}>
            {guardando
              ? 'Guardando...'
              : vehiculoEditar
              ? 'Guardar cambios'
              : 'Registrar vehículo'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Cabecera({
  alVolver,
  titulo = 'Registrar vehículo',
}: {
  alVolver: () => void;
  titulo?: string;
}) {
  return (
    <View style={estilos.cabecera}>
      <Pressable
        accessibilityLabel="Volver"
        accessibilityRole="button"
        onPress={alVolver}
        style={estilos.volver}
      >
        <Text style={estilos.flechaVolver}>‹</Text>
      </Pressable>
      <Text style={estilos.titulo}>{titulo}</Text>
    </View>
  );
}

function Campo({
  etiqueta,
  valor,
  alCambiar,
  placeholder,
  teclado,
  mitad,
  mayusculas,
  deshabilitado,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (texto: string) => void;
  placeholder: string;
  teclado?: 'number-pad';
  mitad?: boolean;
  mayusculas?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <View style={mitad ? estilos.campoMitad : estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        editable={!deshabilitado}
        accessibilityLabel={etiqueta}
        autoCapitalize={mayusculas ? 'characters' : 'words'}
        keyboardType={teclado}
        onChangeText={alCambiar}
        placeholder={placeholder}
        placeholderTextColor="#77777F"
        style={estilos.entrada}
        value={valor}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0D0D0E' },
  contenido: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  contenidoConfirmacion: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 25,
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
  etiqueta: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 7,
  },
  buscador: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 12,
    paddingRight: 13,
  },
  entradaBuscador: {
    flex: 1,
    color: '#F4F4F5',
    paddingHorizontal: 13,
    fontSize: 14,
  },
  resultados: {
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  resultadoCliente: {
    backgroundColor: '#171719',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#303034',
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  nombreResultado: { color: '#F4F4F5', fontSize: 13, fontWeight: '700' },
  contactoResultado: { color: '#85858C', fontSize: 11, marginTop: 3 },
  clienteSeleccionado: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 12,
    padding: 13,
  },
  datosCliente: { flex: 1 },
  nombreCliente: { color: '#F4F4F5', fontSize: 14, fontWeight: '700' },
  contactoCliente: { color: '#85858C', fontSize: 11, marginTop: 4 },
  cambiarCliente: { color: '#5BE0BB', fontSize: 12, fontWeight: '700' },
  sinResultados: { color: '#85858C', fontSize: 12, marginTop: 10 },
  separador: { height: 1, backgroundColor: '#29292D', marginVertical: 24 },
  fila: { flexDirection: 'row', gap: 10 },
  campo: { marginBottom: 16 },
  campoMitad: { flex: 1, marginBottom: 16 },
  entrada: {
    minHeight: 50,
    color: '#F4F4F5',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  opcionesCombustible: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  combustible: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 12,
  },
  combustibleActivo: { backgroundColor: '#153B32', borderColor: '#13C296' },
  textoCombustible: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  textoCombustibleActivo: { color: '#75E4C5' },
  areaTexto: {
    minHeight: 92,
    color: '#F4F4F5',
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#303034',
    borderRadius: 12,
    padding: 13,
    fontSize: 13,
    marginBottom: 16,
  },
  error: { color: '#FF9C94', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  boton: {
    minHeight: 52,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13C296',
    borderRadius: 13,
    marginTop: 5,
  },
  textoBoton: { color: '#061B15', fontSize: 14, fontWeight: '800' },
  botonSecundario: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 13,
    marginTop: 12,
  },
  textoBotonSecundario: { color: '#E4E4E7', fontSize: 14, fontWeight: '700' },
  confirmacion: {
    backgroundColor: '#171719',
    borderWidth: 1,
    borderColor: '#2D2D31',
    borderRadius: 15,
    padding: 18,
    marginBottom: 20,
  },
  tituloConfirmacion: { color: '#75E4C5', fontSize: 14, fontWeight: '700' },
  nombreConfirmacion: { color: '#F4F4F5', fontSize: 17, marginTop: 8 },
  clienteConfirmacion: { color: '#85858C', fontSize: 12, marginTop: 6 },
  presionado: { opacity: 0.78 },
  deshabilitado: { opacity: 0.55 },
});

export default RegistrarVehiculo;
