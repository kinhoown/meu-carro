/**
 * Configuração do Firebase do app.
 *
 * Estes valores NÃO são segredos: o Firebase os coloca dentro de todo app publicado.
 * Quem protege os dados são as regras do Firestore (firestore.rules) e o login.
 *
 * Onde pegar (veja o README, seção "Firebase"):
 *  - firebase: Console do Firebase → ⚙ Configurações do projeto → Seus apps → app da Web → "Config".
 *  - googleWebClientId: Authentication → Método de login → Google → "Configuração do SDK da Web"
 *    → "ID do cliente da Web".
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBdgFwDDp4VtCsMkEIR2mgiXHUxzZgZJzE',
  authDomain: 'meu-carro-69922.firebaseapp.com',
  projectId: 'meu-carro-69922',
  storageBucket: 'meu-carro-69922.firebasestorage.app',
  messagingSenderId: '538660464414',
  appId: '1:538660464414:android:4925ab1f23551bc528cb0f',
};

export const googleWebClientId = '538660464414-4avf0r58clm4f2d2m9h9g7so6bv9fvs7.apps.googleusercontent.com';
