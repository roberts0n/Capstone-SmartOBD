import { NativeModules, Platform } from 'react-native';
import { nombreInformeDtc, type InformePruebaDtc } from '../obd/dtc/PruebaDtc';

interface ExportadorNativo {
  guardarJson: (nombre: string, json: string) => Promise<string | null>;
  mantenerPantallaEncendida?: (activa: boolean) => Promise<void>;
}

export async function mantenerPantallaRegistro(activa: boolean): Promise<void> {
  const exportador = NativeModules.InformesDtc as ExportadorNativo | undefined;
  if (Platform.OS !== 'android' || !exportador?.mantenerPantallaEncendida) {
    if (!activa) return;
    throw new Error(
      'El registro requiere Android y recompilar la app para mantener la pantalla encendida.',
    );
  }
  await exportador.mantenerPantallaEncendida(activa);
}

/** null significa que el usuario cancelo; no se anuncia un guardado inexistente. */
export async function guardarInformeDtc(
  informe: InformePruebaDtc,
): Promise<string | null> {
  return guardarInformeJson(nombreInformeDtc(informe), informe);
}

// reutilizo el selector para otras capturas tecnicas, no solo para los dtc
export async function guardarInformeJson(
  nombre: string,
  informe: unknown,
): Promise<string | null> {
  const exportador = NativeModules.InformesDtc as ExportadorNativo | undefined;
  if (Platform.OS !== 'android' || !exportador) {
    throw new Error(
      'Guardar JSON requiere Android y recompilar la app con el modulo InformesDtc.',
    );
  }
  return exportador.guardarJson(nombre, JSON.stringify(informe, null, 2));
}
