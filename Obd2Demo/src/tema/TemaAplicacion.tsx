import React, {
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  guardarPreferenciaTema,
  leerPreferenciaLocal,
  leerPreferenciaRemota,
} from '../servicios/preferenciaTema';
import {
  ContextoTema,
  type ValorContextoTema,
  type ModoTema,
  TEMAS,
} from './tokensTema';

export function ProveedorTema({ children }: PropsWithChildren) {
  const [modo, establecerModo] = useState<ModoTema>('claro');
  const usuarioActual = useRef<string | null>(null);
  const solicitudActual = useRef(0);

  const aplicarModo = useCallback(
    (siguiente: ModoTema) => establecerModo(siguiente),
    [],
  );

  useEffect(
    () => () => {
      solicitudActual.current += 1;
    },
    [],
  );

  const cargarTemaUsuario = useCallback(
    async (usuarioId: string | null) => {
      const solicitud = ++solicitudActual.current;
      usuarioActual.current = usuarioId;
      aplicarModo('claro');
      if (!usuarioId) return;

      const preferenciaLocal = await leerPreferenciaLocal(usuarioId);
      if (solicitud !== solicitudActual.current) return;
      if (preferenciaLocal) aplicarModo(preferenciaLocal);

      leerPreferenciaRemota(usuarioId).then(preferenciaRemota => {
        if (
          preferenciaRemota &&
          solicitud === solicitudActual.current &&
          usuarioActual.current === usuarioId
        ) {
          aplicarModo(preferenciaRemota);
          guardarPreferenciaTema(usuarioId, preferenciaRemota, false).catch(
            () => undefined,
          );
        }
      });
    },
    [aplicarModo],
  );

  const cambiarModo = useCallback(
    async (siguiente: ModoTema) => {
      // si ya elegi otro modo, no dejo que una lectura remota atrasada lo reemplace
      solicitudActual.current += 1;
      aplicarModo(siguiente);
      const usuarioId = usuarioActual.current;
      if (usuarioId) await guardarPreferenciaTema(usuarioId, siguiente, true);
    },
    [aplicarModo],
  );

  const valor = useMemo<ValorContextoTema>(
    () => ({
      modo,
      colores: TEMAS[modo],
      cargarTemaUsuario,
      cambiarModo,
    }),
    [modo, cargarTemaUsuario, cambiarModo],
  );

  return (
    <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>
  );
}

export function useTema(): ValorContextoTema {
  const contexto = useContext(ContextoTema);
  if (!contexto) {
    throw new Error('useTema debe utilizarse dentro de ProveedorTema.');
  }
  return contexto;
}
