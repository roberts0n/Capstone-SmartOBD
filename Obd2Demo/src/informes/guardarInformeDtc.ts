import { NativeModules, Platform } from 'react-native';
import { nombreInformeDtc, type InformePruebaDtc } from '../obd/dtc/PruebaDtc';

interface ExportadorNativo {
  guardarJson: (nombre: string, json: string) => Promise<string | null>;
}

/** null significa que el usuario cancelo; no se anuncia un guardado inexistente. */
export async function guardarInformeDtc(
  informe: InformePruebaDtc,
): Promise<string | null> {
  const exportador = NativeModules.InformesDtc as ExportadorNativo | undefined;
  if (Platform.OS !== 'android' || !exportador) {
    throw new Error(
      'Guardar JSON requiere Android y recompilar la app con el modulo InformesDtc.',
    );
  }
  return exportador.guardarJson(
    nombreInformeDtc(informe),
    JSON.stringify(informe, null, 2),
  );
}
