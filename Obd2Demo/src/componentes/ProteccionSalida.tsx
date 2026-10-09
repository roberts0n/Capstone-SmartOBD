import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
} from 'react';
import { Alert } from 'react-native';

interface CondicionesSalida {
  ocupado: boolean;
  cambios?: boolean;
  cancelar?: () => void;
  etiquetaCancelar?: string;
  mensajeOcupado?: string;
}
type SolicitarSalida = (continuar: () => void) => void;
const ContextoSalida = createContext<{
  registrar: (proteccion: SolicitarSalida) => () => void;
  solicitar: SolicitarSalida;
} | null>(null);

export function ProveedorProteccionSalida({
  children,
}: {
  children: React.ReactNode;
}) {
  const proteccion = useRef<SolicitarSalida | null>(null);
  const registrar = useCallback((siguiente: SolicitarSalida) => {
    proteccion.current = siguiente;
    return () => {
      if (proteccion.current === siguiente) proteccion.current = null;
    };
  }, []);
  const solicitar = useCallback<SolicitarSalida>(continuar => {
    if (proteccion.current) proteccion.current(continuar);
    else continuar();
  }, []);
  return (
    <ContextoSalida.Provider value={{ registrar, solicitar }}>
      {children}
    </ContextoSalida.Provider>
  );
}

export function useSolicitudSalida(): SolicitarSalida {
  const contexto = useContext(ContextoSalida);
  return contexto?.solicitar ?? (continuar => continuar());
}

export function useProteccionSalida(
  condiciones: CondicionesSalida,
): SolicitarSalida {
  const contexto = useContext(ContextoSalida);
  const actuales = useRef(condiciones);
  actuales.current = condiciones;
  const confirmando = useRef(false);
  const activa = useRef(true);
  const solicitar = useCallback<SolicitarSalida>(continuar => {
    if (!activa.current || confirmando.current) return;
    const { ocupado, cambios, cancelar, etiquetaCancelar, mensajeOcupado } =
      actuales.current;
    if (ocupado) {
      Alert.alert(
        'Operación en curso',
        mensajeOcupado ??
          (cancelar
            ? 'Puedes cancelar la captura y salir cuando termine el comando actual.'
            : 'Espera a que termine la operación antes de salir.'),
        cancelar
          ? [
              { text: 'Esperar', style: 'cancel' },
              {
                text: etiquetaCancelar ?? 'Cancelar captura',
                onPress: cancelar,
              },
            ]
          : [{ text: 'Aceptar' }],
      );
      return;
    }
    if (!cambios) {
      continuar();
      return;
    }
    confirmando.current = true;
    Alert.alert(
      'Salir sin guardar',
      'Se perderán los cambios de este formulario.',
      [
        {
          text: 'Seguir editando',
          style: 'cancel',
          onPress: () => {
            confirmando.current = false;
          },
        },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => {
            confirmando.current = false;
            // compruebo de nuevo por si comenzo un guardado mientras estaba abierto el aviso
            if (activa.current && !actuales.current.ocupado) continuar();
          },
        },
      ],
      { cancelable: false },
    );
  }, []);
  const registrar = contexto?.registrar;
  useLayoutEffect(() => {
    activa.current = true;
    const retirar = registrar?.(solicitar);
    return () => {
      activa.current = false;
      retirar?.();
    };
  }, [registrar, solicitar]);
  return solicitar;
}
