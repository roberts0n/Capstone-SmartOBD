import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  obtenerCasoMecanico,
  type CasoMecanico,
} from '../casos/ServicioCasosMecanico';
import { useSesionEscanerObd } from '../escaner/ContextoEscanerObd';
import { ejecutarDeteccionPids } from '../obd/DeteccionPids';
import { ejecutarLecturaVin } from '../obd/LecturaVin';
import type { ContextoLecturaMode01 } from '../obd/CatalogoPidsMode01';
import { useMuestreoPids } from '../obd/usarMuestreoPids';
import {
  DURACIONES_REGISTRO_MS,
  useRegistroHistoricoPids,
} from '../obd/RegistroHistoricoPids';
import type { SesionTaller } from '../tipos/usuarioTaller';
import {
  guardarRegistroMediciones,
  listarRegistrosMediciones,
  obtenerRegistroMediciones,
  prepararRegistroMediciones,
  type RegistroMediciones,
  type ResumenRegistroMediciones,
  type NuevoRegistroMediciones,
} from './RegistrosMediciones';

type Preparacion = {
  version: number;
  contexto: ContextoLecturaMode01;
  vin: string | null;
};
const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : 'No se pudo completar la operación.';

// coordino el caso sin mover la conexion ni las formulas fuera de sus modulos
export function useMedicionesCaso(
  casoId: string,
  sesion: SesionTaller,
  visible: boolean,
) {
  const escaner = useSesionEscanerObd();
  const vivo = useMuestreoPids(escaner);
  const historico = useRegistroHistoricoPids(escaner);
  const [caso, establecerCaso] = useState<CasoMecanico | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [operacion, establecerOperacion] = useState<string | null>(null);
  const [error, establecerError] = useState<string | null>(null);
  const [preparacion, establecerPreparacion] = useState<Preparacion | null>(
    null,
  );
  const [pendiente, establecerPendiente] = useState<Preparacion | null>(null);
  const [guardado, establecerGuardado] = useState<string | null>(null);
  const [avisoGuardado, establecerAvisoGuardado] = useState<string | null>(
    null,
  );
  const [registros, establecerRegistros] = useState<
    ResumenRegistroMediciones[]
  >([]);
  const [pagina, establecerPagina] = useState(0);
  const [hayMas, establecerHayMas] = useState(false);
  const [registroAbierto, establecerRegistroAbierto] =
    useState<RegistroMediciones | null>(null);
  const [errorRegistros, establecerErrorRegistros] = useState<string | null>(
    null,
  );
  const [cargandoRegistros, establecerCargandoRegistros] = useState(false);
  const bloqueo = useRef(false);
  const montado = useRef(true);
  const cancelado = useRef(false);
  const consulta = useRef(0);
  const intentoGuardado = useRef<NuevoRegistroMediciones | null>(null);
  const [tituloFijado, establecerTituloFijado] = useState(false);
  const version = escaner.obtenerVersionConexion();
  const actuales = useRef({ escaner, visible, vivo, historico });
  actuales.current = { escaner, visible, vivo, historico };

  useEffect(() => {
    montado.current = true;
    const sub = AppState.addEventListener('change', estado => {
      if (estado !== 'active') cancelado.current = true;
    });
    return () => {
      montado.current = false;
      cancelado.current = true;
      consulta.current += 1;
      sub.remove();
    };
  }, []);

  async function consultarCaso(exigirRevision = false) {
    const actual = await obtenerCasoMecanico(casoId, sesion);
    if (!montado.current) throw new Error('La pantalla ya no está disponible.');
    establecerCaso(actual);
    if (!actual) {
      establecerPreparacion(null);
      establecerPendiente(null);
      throw new Error('Este caso ya no está disponible para tu cuenta.');
    }
    if (exigirRevision && actual.estado !== 'en_revision')
      throw new Error(
        'Inicia la revisión del caso antes de realizar mediciones.',
      );
    return actual;
  }

  async function actualizarCaso() {
    if (bloqueo.current) return;
    establecerCargando(true);
    establecerError(null);
    try {
      await consultarCaso();
    } catch (e) {
      if (montado.current) establecerError(mensajeError(e));
    } finally {
      if (montado.current) establecerCargando(false);
    }
  }

  useEffect(() => {
    let activa = true;
    obtenerCasoMecanico(casoId, sesion)
      .then(actual => {
        if (!activa) return;
        establecerCaso(actual);
        if (!actual)
          establecerError('Este caso ya no está disponible para tu cuenta.');
      })
      .catch(e => {
        if (activa) establecerError(mensajeError(e));
      })
      .finally(() => {
        if (activa) establecerCargando(false);
      });
    return () => {
      activa = false;
    };
  }, [casoId, sesion]);

  function comprobarConexion(esperada: number) {
    const actual = actuales.current;
    if (
      !montado.current ||
      !actual.visible ||
      cancelado.current ||
      (AppState.currentState && AppState.currentState !== 'active')
    )
      throw new Error(
        'Preparación interrumpida. Vuelve a intentarlo desde la app.',
      );
    if (
      esperada !== actual.escaner.obtenerVersionConexion() ||
      !actual.escaner.estaPreparado() ||
      !actual.escaner.conectado()
    )
      throw new Error('La conexión cambió. Vuelve a preparar las mediciones.');
    if (!actual.escaner.estaSincronizado())
      throw new Error(
        'La comunicación quedó incompleta. Reconecta el escáner.',
      );
  }

  async function preparar() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    cancelado.current = false;
    establecerOperacion('Preparando mediciones…');
    establecerError(null);
    establecerPreparacion(null);
    establecerPendiente(null);
    const esperada = actuales.current.escaner.obtenerVersionConexion();
    try {
      const actual = await consultarCaso(true);
      comprobarConexion(esperada);
      const enviar = async (comando: string) => {
        comprobarConexion(esperada);
        const respuesta = await actuales.current.escaner.enviarComando(comando);
        comprobarConexion(esperada);
        return respuesta;
      };
      if (!escaner.estaSuscrito() && !escaner.activarSuscripcion())
        throw new Error('No se pudo recibir información del escáner.');
      for (const comando of ['ATE0', 'ATL0', 'ATS1', 'ATH0', 'ATSP0']) {
        const respuesta = await enviar(comando);
        if (
          !respuesta.textoAscii
            .replace(/>/g, '')
            .split(/[\r\n]+/)
            .some(linea => linea.trim().toUpperCase() === 'OK')
        )
          throw new Error(
            'El escáner no confirmó la preparación. Reconéctalo e inténtalo nuevamente.',
          );
      }
      const lecturaVin = await ejecutarLecturaVin(enviar);
      // la lectura vin puede devolver una advertencia; eso no debe ocultar una desconexion
      comprobarConexion(esperada);
      if (
        lecturaVin.vin &&
        actual.vin &&
        lecturaVin.vin.toUpperCase() !== actual.vin.toUpperCase()
      )
        throw new Error(
          'El VIN del escáner no corresponde al vehículo de este caso.',
        );
      if (lecturaVin.advertencia?.includes('VIN distintos'))
        throw new Error(
          'El escáner respondió con vehículos distintos. Revisa la conexión.',
        );
      const deteccion = await ejecutarDeteccionPids({
        enviar,
        cancelado: () => cancelado.current,
      });
      comprobarConexion(esperada);
      const lista = {
        version: esperada,
        contexto: deteccion.contextoMode01,
        vin: lecturaVin.vin,
      };
      if (lecturaVin.vin && actual.vin) establecerPreparacion(lista);
      else establecerPendiente(lista);
    } catch (e) {
      if (montado.current) establecerError(mensajeError(e));
    } finally {
      bloqueo.current = false;
      if (montado.current) establecerOperacion(null);
    }
  }

  // cada conexion nueva necesita su propia deteccion, aunque el caso siga abierto
  const puedePreparar =
    visible &&
    !cargando &&
    caso?.estado === 'en_revision' &&
    escaner.estaPreparado();
  useEffect(() => {
    establecerPreparacion(null);
    establecerPendiente(null);
    if (puedePreparar) preparar().catch(() => undefined);
    // preparo una vez por conexion o al regresar, no por cada muestra del grafico
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, puedePreparar]);

  function confirmarVehiculo() {
    if (!pendiente || bloqueo.current) return;
    try {
      comprobarConexion(pendiente.version);
      establecerPreparacion(pendiente);
      establecerPendiente(null);
      establecerError(null);
    } catch (e) {
      establecerPendiente(null);
      establecerError(mensajeError(e));
    }
  }

  async function iniciar(
    tipo: 'vivo' | 'historico',
    comandos: readonly string[],
    duracionMs = 60000,
  ) {
    if (bloqueo.current || !preparacion) return;
    bloqueo.current = true;
    cancelado.current = false;
    establecerOperacion('Comprobando caso…');
    establecerError(null);
    try {
      const actual = await consultarCaso(true);
      comprobarConexion(preparacion.version);
      if (preparacion.vin && actual.vin && preparacion.vin !== actual.vin)
        throw new Error(
          'El VIN registrado cambió. Prepara nuevamente las mediciones.',
        );
      if (
        tipo === 'historico' &&
        !DURACIONES_REGISTRO_MS.some(ms => ms === duracionMs)
      )
        throw new Error('Selecciona una duración de 1, 5 o 10 minutos.');
      establecerOperacion(
        tipo === 'vivo' ? 'Lectura en curso' : 'Registro en curso',
      );
      if (tipo === 'vivo')
        await actuales.current.vivo.iniciar(comandos[0], preparacion.contexto);
      else {
        establecerGuardado(null);
        establecerAvisoGuardado(null);
        intentoGuardado.current = null;
        establecerTituloFijado(false);
        await actuales.current.historico.iniciar(
          comandos,
          duracionMs,
          preparacion.contexto,
        );
      }
    } catch (e) {
      if (montado.current) establecerError(mensajeError(e));
    } finally {
      bloqueo.current = false;
      if (montado.current) establecerOperacion(null);
    }
  }

  async function cargarRegistros(siguiente = 0) {
    const numero = ++consulta.current;
    establecerCargandoRegistros(true);
    establecerErrorRegistros(null);
    try {
      const filas = await listarRegistrosMediciones(casoId, sesion, {
        desde: siguiente * 20,
        limite: 21,
      });
      if (!montado.current || numero !== consulta.current) return;
      establecerRegistros(filas.slice(0, 20));
      establecerHayMas(filas.length > 20);
      establecerPagina(siguiente);
    } catch (e) {
      if (montado.current && numero === consulta.current)
        establecerErrorRegistros(mensajeError(e));
    } finally {
      if (montado.current && numero === consulta.current)
        establecerCargandoRegistros(false);
    }
  }

  async function abrirRegistro(id: string) {
    const numero = ++consulta.current;
    establecerCargandoRegistros(true);
    establecerErrorRegistros(null);
    establecerRegistroAbierto(null);
    try {
      await consultarCaso();
      const registro = await obtenerRegistroMediciones(id, casoId, sesion);
      if (!montado.current || numero !== consulta.current) return;
      if (!registro) throw new Error('El registro ya no está disponible.');
      establecerRegistroAbierto(registro);
    } catch (e) {
      if (montado.current && numero === consulta.current)
        establecerErrorRegistros(mensajeError(e));
    } finally {
      if (montado.current && numero === consulta.current)
        establecerCargandoRegistros(false);
    }
  }

  async function guardar(titulo: string) {
    if (
      bloqueo.current ||
      !historico.registro?.fin ||
      guardado === historico.registro.inicio
    )
      return;
    bloqueo.current = true;
    establecerOperacion('Guardando registro…');
    establecerAvisoGuardado(null);
    try {
      const entrada =
        intentoGuardado.current ??
        prepararRegistroMediciones(casoId, historico.registro, titulo);
      // conservo el mismo envio si la red falla despues de que la bd lo haya recibido
      intentoGuardado.current = entrada;
      establecerTituloFijado(true);
      await consultarCaso();
      await guardarRegistroMediciones(entrada, sesion);
      if (montado.current) {
        establecerGuardado(historico.registro.inicio);
        establecerAvisoGuardado('Registro guardado en el caso.');
      }
    } catch (e) {
      if (montado.current) establecerAvisoGuardado(mensajeError(e));
    } finally {
      bloqueo.current = false;
      if (montado.current) establecerOperacion(null);
    }
  }

  function detener() {
    cancelado.current = true;
    vivo.detener();
    historico.detener();
  }
  const sinGuardar =
    !!historico.registro?.fin &&
    historico.registro.series.some(serie =>
      serie.muestras.some(muestra => muestra.valor !== null),
    ) &&
    guardado !== historico.registro.inicio;
  return {
    caso,
    cargando,
    operacion,
    error,
    vivo,
    historico,
    pendiente,
    actualizarCaso,
    tituloFijado,
    preparado: preparacion?.version === version && escaner.estaPreparado(),
    pids:
      preparacion?.version === version
        ? preparacion.contexto.pidsSoportados
        : null,
    conectado: escaner.estaPreparado(),
    preparar,
    confirmarVehiculo,
    iniciar,
    detener,
    sinGuardar,
    guardado:
      !!historico.registro?.inicio && guardado === historico.registro.inicio,
    guardar,
    avisoGuardado,
    registros,
    pagina,
    hayMas,
    registroAbierto,
    errorRegistros,
    cargandoRegistros,
    cargarRegistros,
    abrirRegistro,
    cerrarRegistro: () => establecerRegistroAbierto(null),
    estaOcupado: () => bloqueo.current,
  };
}
