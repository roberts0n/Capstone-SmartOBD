import type { SesionTaller } from '../tipos/usuarioTaller';
import { supabase } from '../servicios/clienteSupabase';
import type {
  NuevoVehiculoTaller,
  TipoCombustible,
  VehiculoTaller,
} from './TiposVehiculo';

interface FilaVehiculo {
  id: string;
  taller_id: string;
  cliente_id: string;
  vin: string | null;
  patente: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  combustible: string | null;
  antecedentes_vehiculo: string | null;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
}

const CAMPOS_VEHICULO =
  'id, taller_id, cliente_id, vin, patente, marca, modelo, anio, combustible, antecedentes_vehiculo, creado_por, creado_en, actualizado_en';

export async function crearVehiculo(
  entrada: NuevoVehiculoTaller,
  sesion: SesionTaller,
): Promise<VehiculoTaller> {
  validarSesionRecepcion(sesion);

  const clienteId = entrada.clienteId.trim();
  if (!clienteId) {
    throw new Error('Selecciona un cliente antes de registrar el vehiculo.');
  }

  const vin = normalizarVin(entrada.vin);
  const combustible = validarCombustible(entrada.combustible);
  validarAnio(entrada.anio);

  const { data, error } = await supabase
    .from('vehiculos')
    .insert({
      taller_id: sesion.tallerId,
      cliente_id: clienteId,
      vin,
      patente: normalizarPatente(entrada.patente),
      marca: textoOpcional(entrada.marca),
      modelo: textoOpcional(entrada.modelo),
      anio: entrada.anio ?? null,
      combustible,
      antecedentes_vehiculo: textoOpcional(entrada.antecedentesVehiculo),
      creado_por: sesion.usuarioId,
    })
    .select(CAMPOS_VEHICULO)
    .single();

  if (error || !data) {
    throw new Error(mensajeErrorCreacion(error));
  }

  return convertirVehiculo(data as FilaVehiculo);
}

export async function obtenerVehiculo(
  vehiculoId: string,
): Promise<VehiculoTaller | null> {
  const identificador = vehiculoId.trim();
  if (!identificador) {
    throw new Error('Se necesita el identificador del vehiculo.');
  }

  const { data, error } = await supabase
    .from('vehiculos')
    .select(CAMPOS_VEHICULO)
    .eq('id', identificador)
    .maybeSingle();

  if (error) {
    throw new Error('No se pudo recuperar el vehiculo.');
  }

  return data ? convertirVehiculo(data as FilaVehiculo) : null;
}

export async function asignarVinVehiculo(
  vehiculoId: string,
  valorVin: string,
  sesion: SesionTaller,
): Promise<VehiculoTaller> {
  validarSesionRecepcion(sesion);
  const identificador = vehiculoId.trim();
  if (!identificador) {
    throw new Error('Se necesita el identificador del vehiculo.');
  }
  const vin = normalizarVin(valorVin);
  if (!vin) {
    throw new Error('Se necesita un VIN valido para identificar el vehiculo.');
  }

  const vehiculoActual = await obtenerVehiculo(identificador);
  if (!vehiculoActual) {
    throw new Error('El vehiculo no existe o no pertenece al taller.');
  }
  if (vehiculoActual.vin === vin) {
    return vehiculoActual;
  }
  if (vehiculoActual.vin) {
    throw new Error(
      'El vehiculo ya tiene un VIN diferente. Revisa el caso antes de continuar.',
    );
  }

  const { data, error } = await supabase
    .from('vehiculos')
    .update({ vin })
    .eq('id', identificador)
    .is('vin', null)
    .select(CAMPOS_VEHICULO)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error(
        'El VIN obtenido ya pertenece a otro vehiculo registrado.',
      );
    }
    throw new Error('No se pudo asignar el VIN al vehiculo.');
  }
  if (data) {
    return convertirVehiculo(data as FilaVehiculo);
  }

  const vehiculoRecargado = await obtenerVehiculo(identificador);
  if (vehiculoRecargado?.vin === vin) {
    return vehiculoRecargado;
  }
  throw new Error(
    'El VIN del vehiculo cambio durante la lectura. Revisa el caso antes de continuar.',
  );
}

export async function listarVehiculosCliente(
  clienteId: string,
): Promise<VehiculoTaller[]> {
  const identificador = clienteId.trim();
  if (!identificador) {
    throw new Error('Se necesita el identificador del cliente.');
  }

  const { data, error } = await supabase
    .from('vehiculos')
    .select(CAMPOS_VEHICULO)
    .eq('cliente_id', identificador)
    .order('creado_en', { ascending: false });

  if (error) {
    throw new Error('No se pudieron obtener los vehiculos del cliente.');
  }

  return ((data ?? []) as FilaVehiculo[]).map(convertirVehiculo);
}

function validarSesionRecepcion(sesion: SesionTaller): void {
  if (sesion.perfil !== 'recepcion') {
    throw new Error('Solo recepcion puede registrar vehiculos.');
  }
  if (!sesion.tallerId.trim() || !sesion.usuarioId.trim()) {
    throw new Error('La sesion no contiene los datos necesarios del taller.');
  }
}

function normalizarVin(valor: string | null | undefined): string | null {
  const vin = valor?.trim().toUpperCase() || null;
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    throw new Error('El VIN debe tener 17 caracteres validos.');
  }
  return vin;
}

function normalizarPatente(valor: string | null | undefined): string | null {
  return valor?.replace(/[\s-]/g, '').toUpperCase() || null;
}

function validarAnio(anio: number | null | undefined): void {
  if (anio == null) {
    return;
  }
  if (!Number.isInteger(anio) || anio < 1886 || anio > 2200) {
    throw new Error('El ano del vehiculo no es valido.');
  }
}

function validarCombustible(
  combustible: string | null | undefined,
): TipoCombustible | null {
  const normalizado = combustible?.trim().toLowerCase() ?? null;
  if (!normalizado) {
    return null;
  }
  if (normalizado !== 'gasolina' && normalizado !== 'diesel') {
    throw new Error('El combustible debe ser gasolina o diesel.');
  }
  return normalizado;
}

function textoOpcional(valor: string | null | undefined): string | null {
  return valor?.trim() || null;
}

function convertirVehiculo(fila: FilaVehiculo): VehiculoTaller {
  return {
    id: fila.id,
    tallerId: fila.taller_id,
    clienteId: fila.cliente_id,
    vin: fila.vin,
    patente: fila.patente,
    marca: fila.marca,
    modelo: fila.modelo,
    anio: fila.anio,
    combustible: fila.combustible,
    antecedentesVehiculo: fila.antecedentes_vehiculo,
    creadoPor: fila.creado_por,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

function mensajeErrorCreacion(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code;

  if (codigo === '23503') {
    return 'El cliente seleccionado no existe o no pertenece al taller.';
  }
  if (codigo === '23505') {
    return 'Ya existe un vehiculo con esa patente o VIN.';
  }
  if (codigo === '42501') {
    return 'Tu cuenta no tiene permiso para registrar vehiculos.';
  }

  return 'No se pudo registrar el vehiculo. Intenta nuevamente.';
}
