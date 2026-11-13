import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, Text, View } from 'react-native';
import { Button, colors, Field, Muted, styles } from '@/components/ui';
import { isGoogleConfigured, signInWithGoogle } from '@/lib/google';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

const NOT_CONFIGURED =
  'Esta versão foi gerada sem a configuração do Firebase, então o login ainda não funciona. ' +
  'Preencha o firebase.config.ts e instale a próxima atualização.';

export default function Login() {
  const [mode, setMode] = useState<'entrar' | 'cadastrar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function google() {
    if (!isFirebaseConfigured) {
      Alert.alert('Servidor não configurado', NOT_CONFIGURED);
      return;
    }
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Login com Google', (e as Error).message);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function submit() {
    if (!isFirebaseConfigured) {
      Alert.alert('Servidor não configurado', NOT_CONFIGURED);
      return;
    }
    if (!email.trim() || password.length < 6) {
      Alert.alert('Atenção', 'Informe o e-mail e uma senha com pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'entrar') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e) {
      Alert.alert('Erro', translateAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="height" style={[styles.screen, { justifyContent: 'center', padding: 24 }]}>
      <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text }}>Meu Carro</Text>
      <View style={{ marginBottom: 24 }}>
        <Muted>Manutenções e diagnóstico OBD do seu veículo</Muted>
      </View>

      {!isFirebaseConfigured && (
        <View
          style={{
            backgroundColor: colors.warning + '22',
            borderColor: colors.warning,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>Servidor não configurado</Text>
          <Text style={{ color: colors.text }}>{NOT_CONFIGURED}</Text>
        </View>
      )}

      <Button
        title="Entrar com Google"
        onPress={google}
        loading={googleLoading}
        disabled={!isGoogleConfigured}
      />
      {!isGoogleConfigured && isFirebaseConfigured && (
        <View style={{ marginTop: 6 }}>
          <Muted>Login com Google ainda não configurado nesta versão.</Muted>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ marginHorizontal: 12, color: colors.muted }}>ou com e-mail</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry />

      <Button title={mode === 'entrar' ? 'Entrar' : 'Criar conta'} onPress={submit} loading={loading} />

      <Pressable
        onPress={() => setMode(mode === 'entrar' ? 'cadastrar' : 'entrar')}
        style={{ marginTop: 16, alignItems: 'center' }}
      >
        <Text style={{ color: colors.primary, fontWeight: '600' }}>
          {mode === 'entrar' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.push('/settings')} style={{ marginTop: 32, alignItems: 'center' }}>
        <Text style={{ color: colors.muted }}>Configurações e atualizações</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function translateAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Se você usou o Google antes, entre com o Google.';
    case 'auth/weak-password':
      return 'Senha fraca: use pelo menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet.';
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Ative "E-mail/senha" no Firebase (Authentication → Método de login).';
    default:
      return (e as Error)?.message ?? String(e);
  }
}
