import type {
  ContextoChatbot,
  DtcChatbot,
  EntradaContextoChatbot,
  LecturaPidChatbot,
  ValorLecturaChatbot,
} from './TiposChatbot';

const PATRON_DTC = /^[PCBU][0-3][0-9A-F]{3}$/;
const PATRON_PID_MODE_01 = /^01[0-9A-F]{2}$/;

export function construirContextoChatbot(
  entrada: EntradaContextoChatbot,
): ContextoChatbot {
  validarRelaciones(entrada);

  return {
    vehiculo: {
      id: entrada.vehiculo.id,
      patente: textoOpcional(entrada.vehiculo.patente),
      marca: textoOpcional(entrada.vehiculo.marca),
      modelo: textoOpcional(entrada.vehiculo.modelo),
      anio: entrada.vehiculo.anio,
      combustible: textoOpcional(entrada.vehiculo.combustible),
      vin: textoOpcional(entrada.vehiculo.vinEscaneado)?.toUpperCase() ?? null,
    },
    caso: {
      id: entrada.caso.id,
      estado: entrada.caso.estado,
      motivoIngreso: entrada.caso.motivoIngreso.trim(),
      sintomasInformados: textoOpcional(entrada.caso.sintomasInformados),
      prioridad: entrada.caso.prioridad,
      fechaCreacion: entrada.caso.fechaCreacion,
    },
    dtc: filtrarDtc(entrada),
    lecturas: filtrarLecturas(entrada),
    antecedentes: entrada.antecedentes
      .filter(
        antecedente =>
          antecedente.vehiculoId === entrada.vehiculo.id &&
          antecedente.casoId !== entrada.caso.id &&
          antecedente.cerrado,
      )
      .map(antecedente => ({
        casoId: antecedente.casoId,
        fecha: antecedente.fecha,
        motivoIngreso: antecedente.motivoIngreso.trim(),
        dtc: normalizarCodigosDtc(antecedente.dtc),
        conclusionTecnica: textoOpcional(antecedente.conclusionTecnica),
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
}

function validarRelaciones(entrada: EntradaContextoChatbot): void {
  if (entrada.vehiculo.clienteId !== entrada.cliente.id) {
    throw new Error('El vehiculo no pertenece al cliente seleccionado.');
  }
  if (entrada.caso.vehiculoId !== entrada.vehiculo.id) {
    throw new Error('El caso no pertenece al vehiculo seleccionado.');
  }
}

function filtrarDtc(entrada: EntradaContextoChatbot): DtcChatbot[] {
  const vistos = new Set<string>();
  const resultado: DtcChatbot[] = [];

  for (const elemento of entrada.dtc) {
    const codigo = elemento.codigo.trim().toUpperCase();
    const clave = `${codigo}:${elemento.estado}`;
    if (
      elemento.casoId !== entrada.caso.id ||
      !elemento.valido ||
      !PATRON_DTC.test(codigo) ||
      vistos.has(clave)
    ) {
      continue;
    }

    vistos.add(clave);
    resultado.push({
      codigo,
      estado: elemento.estado,
      fecha: elemento.fecha,
    });
  }

  return resultado;
}

function filtrarLecturas(entrada: EntradaContextoChatbot): LecturaPidChatbot[] {
  const resultado: LecturaPidChatbot[] = [];

  for (const lectura of entrada.lecturas) {
    const pid = lectura.pid.trim().toUpperCase();
    if (
      lectura.casoId !== entrada.caso.id ||
      !lectura.compatible ||
      !lectura.valida ||
      !PATRON_PID_MODE_01.test(pid) ||
      !tieneValor(lectura.valor)
    ) {
      continue;
    }

    resultado.push({
      pid,
      nombre: lectura.nombre.trim(),
      valor: copiarValor(lectura.valor),
      unidad: textoOpcional(lectura.unidad),
      fecha: lectura.fecha,
      origen: lectura.origen,
    });
  }

  return resultado;
}

function normalizarCodigosDtc(codigos: readonly string[]): string[] {
  return [
    ...new Set(
      codigos
        .map(codigo => codigo.trim().toUpperCase())
        .filter(codigo => PATRON_DTC.test(codigo)),
    ),
  ];
}

function textoOpcional(valor: string | null): string | null {
  const limpio = valor?.trim() ?? '';
  return limpio.length > 0 ? limpio : null;
}

function tieneValor(
  valor: ValorLecturaChatbot | null,
): valor is ValorLecturaChatbot {
  if (valor === null) return false;
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor === 'string') return valor.trim().length > 0;
  if (Array.isArray(valor)) return valor.length > 0;
  return Object.keys(valor).length > 0;
}

function copiarValor(valor: ValorLecturaChatbot): ValorLecturaChatbot {
  if (Array.isArray(valor)) return [...valor];
  if (typeof valor === 'object') return { ...valor };
  return valor;
}
