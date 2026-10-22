import React, {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
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
  establecerModoTemaActual,
  type ColoresTema,
  type ModoTema,
  TEMAS,
} from './tokensTema';

interface ValorContextoTema {
  modo: ModoTema;
  colores: ColoresTema;
  cargarTemaUsuario: (usuarioId: string | null) => Promise<void>;
  cambiarModo: (modo: ModoTema) => Promise<void>;
}

const ContextoTema = createContext<ValorContextoTema | null>(null);

export function ProveedorTema({ children }: PropsWithChildren) {
  const [modo, establecerModo] = useState<ModoTema>('claro');
  const usuarioActual = useRef<string | null>(null);
  const solicitudActual = useRef(0);

  const aplicarModo = useCallback((siguiente: ModoTema) => {
    establecerModoTemaActual(siguiente);
    establecerModo(siguiente);
  }, []);

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

  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

export function useTema(): ValorContextoTema {
  const contexto = useContext(ContextoTema);
  if (!contexto) {
    throw new Error('useTema debe utilizarse dentro de ProveedorTema.');
  }
  return contexto;
}
