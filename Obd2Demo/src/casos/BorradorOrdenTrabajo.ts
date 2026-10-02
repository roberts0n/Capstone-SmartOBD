export interface BorradorOrdenTrabajo {
  busquedaCliente: string;
  clienteId: string | null;
  vehiculoId: string | null;
  motivoIngreso: string;
}

export function crearBorradorOrdenTrabajo(): BorradorOrdenTrabajo {
  // empiezo cada orden sin arrastrar datos de la atencion anterior
  return {
    busquedaCliente: '',
    clienteId: null,
    vehiculoId: null,
    motivoIngreso: '',
  };
}
