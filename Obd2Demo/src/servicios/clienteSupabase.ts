import 'react-native-url-polyfill/auto';

import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Estos datos identifican al cliente movil y son publicables. La seguridad de
// la informacion depende de Supabase Auth y de las politicas RLS. Nunca se debe
// agregar aqui una clave sb_secret_ ni la antigua service_role.
const URL_SUPABASE = 'https://skcdvgclvphufcneuafc.supabase.co';
const CLAVE_PUBLICABLE_SUPABASE =
  'sb_publishable_6QDbnlkHpfpa0AWfRFeNOA__lA6db_Q';

// Se usa una base local dedicada para no mezclar tokens de autenticacion con
// los escaneres verificados ni con los borradores de informes DTC.
const almacenamientoSesion = createAsyncStorage('smartobd-auth');

export const supabase = createClient(
  URL_SUPABASE,
  CLAVE_PUBLICABLE_SUPABASE,
  {
    auth: {
      storage: almacenamientoSesion,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// React Native no mantiene siempre activos los temporizadores en segundo
// plano. La renovacion de tokens se activa solo mientras la app esta visible.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', estado => {
    if (estado === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
