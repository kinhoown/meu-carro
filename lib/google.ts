import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * ID do cliente OAuth do tipo "Aplicativo da Web" (Google Cloud). É o mesmo que vai no
 * provedor Google do Supabase. O cliente "Android" não aparece no código: o Google o
 * reconhece pelo pacote + SHA-1 da chave de assinatura.
 */
const webClientId = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();

export const isGoogleConfigured = isSupabaseConfigured && webClientId.endsWith('.apps.googleusercontent.com');

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId, scopes: ['email', 'profile'] });
  configured = true;
}

/**
 * Abre o seletor de contas do Google e entra no Supabase com o token recebido.
 * Os dados (veículos, manutenções, leituras) ficam ligados a essa conta: em qualquer
 * celular, entrando com o mesmo Google, aparecem os mesmos dados.
 * Retorna false se o usuário cancelou.
 */
export async function signInWithGoogle(): Promise<boolean> {
  if (!isGoogleConfigured) {
    throw new Error(
      'Esta versão foi gerada sem o ID do Google (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID). ' +
        'Configure o Secret no GitHub e instale a próxima atualização.',
    );
  }
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return false;
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('O Google não devolveu o token de identidade.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
    return true;
  } catch (e) {
    throw new Error(translateGoogleError(e));
  }
}

/** Esquece a conta escolhida, para o seletor aparecer de novo no próximo login. */
export async function signOutGoogle() {
  if (!isGoogleConfigured) return;
  ensureConfigured();
  try {
    await GoogleSignin.signOut();
  } catch {
    // sem sessão Google (entrou por e-mail): nada a fazer
  }
}

function translateGoogleError(e: unknown): string {
  if (isErrorWithCode(e)) {
    if (e.code === statusCodes.IN_PROGRESS) return 'Já existe um login com Google em andamento.';
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
      return 'O Google Play Services não está disponível ou precisa ser atualizado.';
    // DEVELOPER_ERROR (10): SHA-1 ou ID do cliente não batem com o Google Cloud.
    if (String(e.code) === '10' || /DEVELOPER_ERROR/i.test(e.message))
      return 'Login com Google não autorizado para este app (confira o pacote e o SHA-1 no Google Cloud).';
  }
  const msg = (e as Error)?.message ?? String(e);
  if (/provider is not enabled|Unsupported provider/i.test(msg))
    return 'Ative o provedor Google no Supabase (Authentication → Providers → Google).';
  return msg;
}
