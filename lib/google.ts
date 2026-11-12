import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { googleWebClientId } from '../firebase.config';
import { auth, isFirebaseConfigured } from './firebase';

/**
 * O login com Google usa o "ID do cliente da Web" que o Firebase cria ao ativar o Google.
 * O cliente Android é reconhecido pelo pacote + SHA-1 cadastrados no app Android do Firebase.
 */
export const isGoogleConfigured =
  isFirebaseConfigured && googleWebClientId.trim().endsWith('.apps.googleusercontent.com');

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: googleWebClientId.trim(), scopes: ['email', 'profile'] });
  configured = true;
}

/**
 * Abre o seletor de contas do Google e entra no Firebase com o token recebido.
 * Os dados ficam ligados a essa conta: entrando com o mesmo Google em outro celular,
 * aparecem os mesmos veículos e manutenções. Retorna false se o usuário cancelou.
 */
export async function signInWithGoogle(): Promise<boolean> {
  if (!isGoogleConfigured) {
    throw new Error('Esta versão foi gerada sem o ID do cliente Web do Google (firebase.config.ts).');
  }
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return false;
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('O Google não devolveu o token de identidade.');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  } catch (e) {
    throw new Error(translateGoogleError(e));
  }
}

/** Sai do Firebase e esquece a conta Google escolhida (o seletor aparece de novo). */
export async function signOutAll() {
  if (isGoogleConfigured) {
    ensureConfigured();
    try {
      await GoogleSignin.signOut();
    } catch {
      // entrou por e-mail: não há sessão Google
    }
  }
  await signOut(auth);
}

function translateGoogleError(e: unknown): string {
  if (isErrorWithCode(e)) {
    if (e.code === statusCodes.IN_PROGRESS) return 'Já existe um login com Google em andamento.';
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
      return 'O Google Play Services não está disponível ou precisa ser atualizado.';
    // DEVELOPER_ERROR (10): SHA-1 ou pacote não cadastrados no app Android do Firebase.
    if (String(e.code) === '10' || /DEVELOPER_ERROR/i.test(e.message))
      return 'Login com Google não autorizado para este app (confira o SHA-1 no app Android do Firebase).';
    if (e.code === 'auth/operation-not-allowed')
      return 'Ative o Google no Firebase (Authentication → Método de login → Google).';
  }
  return (e as Error)?.message ?? String(e);
}
