import { useEffect, useState } from 'react';
import { listarClientes, obtenerCliente } from './ServicioClientes';
import type { ClienteTaller } from './TiposCliente';

const TAMANO_PAGINA = 6;

export function useBusquedaClientes(
  busqueda: string,
  clienteId?: string | null,
) {
  const [clientes, establecerClientes] = useState<ClienteTaller[]>([]);
  const [seleccionado, establecerSeleccionado] = useState<ClienteTaller | null>(
    null,
  );
  const [pagina, establecerPagina] = useState(0);
  const [haySiguiente, establecerHaySiguiente] = useState(false);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState<string | null>(null);
  const [intento, establecerIntento] = useState(0);

  useEffect(() => {
    establecerPagina(0);
  }, [busqueda]);
  useEffect(() => {
    let activa = true;
    establecerCargando(true);
    establecerError(null);
    // busco en la base y descarto la respuesta si ya se cambio de cliente o texto
    const cargar = async () => {
      try {
        if (clienteId) {
          const cliente = await obtenerCliente(clienteId);
          if (!cliente)
            throw new Error('El cliente seleccionado ya no esta disponible.');
          if (activa) establecerSeleccionado(cliente);
        } else {
          const resultado = await listarClientes({
            busqueda,
            desde: pagina * TAMANO_PAGINA,
            limite: TAMANO_PAGINA + 1,
          });
          if (activa) {
            establecerSeleccionado(null);
            establecerClientes(resultado.slice(0, TAMANO_PAGINA));
            establecerHaySiguiente(resultado.length > TAMANO_PAGINA);
          }
        }
      } catch (capturado) {
        if (activa)
          establecerError(
            capturado instanceof Error
              ? capturado.message
              : 'No se pudieron buscar los clientes.',
          );
      } finally {
        if (activa) establecerCargando(false);
      }
    };
    const espera =
      clienteId || !busqueda.trim()
        ? undefined
        : setTimeout(() => {
            cargar().catch(() => undefined);
          }, 300);
    if (!espera) cargar().catch(() => undefined);
    return () => {
      activa = false;
      if (espera) clearTimeout(espera);
    };
  }, [busqueda, clienteId, pagina, intento]);

  return {
    clientes,
    seleccionado:
      (seleccionado?.id === clienteId ? seleccionado : null) ??
      clientes.find(item => item.id === clienteId) ??
      null,
    cargando,
    error,
    pagina,
    haySiguiente,
    establecerPagina,
    reintentar: () => establecerIntento(actual => actual + 1),
  };
}
