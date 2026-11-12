import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

/**
 * false quando o APK foi gerado sem as chaves do Supabase (.env ou Secrets do GitHub).
 * O app precisa abrir mesmo assim — createClient('') lança erro e derrubaria o app na abertura.
 */
export const isSupabaseConfigured = /^https?:\/\//.test(url) && anonKey.length > 0;

if (!isSupabaseConfigured) {
  console.warn('Supabase não configurado: defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://nao-configurado.invalid',
  isSupabaseConfigured ? anonKey : 'nao-configurado',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: isSupabaseConfigured,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Mantém o token renovado só enquanto o app está em primeiro plano.
AppState.addEventListener('change', (state) => {
  if (!isSupabaseConfigured) return;
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
