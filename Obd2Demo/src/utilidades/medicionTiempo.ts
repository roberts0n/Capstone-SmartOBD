interface EntornoConRelojRendimiento {
  performance?: {
    now: () => number;
  };
}

/*entrega un reloj monotono de alta precision cuando el entorno lo permite */
export function obtenerTiempoMs(): number {
  const entorno = globalThis as EntornoConRelojRendimiento;
  return entorno.performance?.now() ?? Date.now();
}
