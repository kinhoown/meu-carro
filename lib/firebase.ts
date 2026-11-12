import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase.config';

/**
 * false quando o firebase.config.ts ainda está vazio. O app precisa abrir mesmo assim
 * (mostra "Servidor não configurado" no login) em vez de fechar na abertura.
 */
export const isFirebaseConfigured =
  firebaseConfig.apiKey.length > 0 && firebaseConfig.projectId.length > 0 && firebaseConfig.appId.length > 0;

if (!isFirebaseConfigured) {
  console.warn('Firebase não configurado: preencha firebase.config.ts');
}

// Com a config vazia, inicializa com valores de mentira só para os objetos existirem;
// nenhuma chamada de rede é feita porque o login fica bloqueado.
const app = getApps().length
  ? getApp()
  : initializeApp(
      isFirebaseConfigured
        ? firebaseConfig
        : { apiKey: 'nao-configurado', projectId: 'nao-configurado', appId: 'nao-configurado' },
    );

// getReactNativePersistence só existe no pacote "react-native" do firebase/auth
// (o Metro escolhe esse), mas os tipos padrão do TypeScript não o declaram.
const getReactNativePersistence = (
  FirebaseAuth as unknown as {
    getReactNativePersistence: (s: typeof AsyncStorage) => FirebaseAuth.Persistence;
  }
).getReactNativePersistence;

/** Login salvo no celular: o usuário continua logado ao reabrir o app. */
export const auth = FirebaseAuth.initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

/**
 * Long polling evita travas do canal de streaming do Firestore no React Native.
 * ignoreUndefinedProperties: campos opcionais vazios não derrubam a gravação.
 */
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true,
});
