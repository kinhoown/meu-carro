import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, Text, View } from 'react-native';
import { Button, colors, Field, Muted, styles } from '@/components/ui';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const NOT_CONFIGURED =
  'Esta versão foi gerada sem as chaves do Supabase, então o login ainda não funciona. ' +
  'Configure os Secrets no GitHub e instale a próxima atualização.';

export default function Login() {
  const [mode, setMode] = useState<'entrar' | 'cadastrar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!isSupabaseConfigured) {
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
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          Alert.alert('Confirme seu e-mail', 'Enviamos um link de confirmação. Depois é só entrar.');
          setMode('entrar');
        }
      }
    } catch (e) {
      Alert.alert('Erro', translateAuthError((e as Error).message));
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

      {!isSupabaseConfigured && (
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

      <Pressable onPress={() => router.push('/updates')} style={{ marginTop: 32, alignItems: 'center' }}>
        <Text style={{ color: colors.muted }}>Atualizações do app</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function translateAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar.';
  if (/already registered/i.test(msg)) return 'Este e-mail já está cadastrado.';
  return msg;
}
