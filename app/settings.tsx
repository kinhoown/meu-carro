import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { Button, Card, colors, Muted, Row, Screen, Segmented, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { signOutAll } from '@/lib/google';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { checkForUpdate, installedVersion, type AppUpdate } from '@/lib/updater';

export default function Settings() {
  const { user } = useAuth();
  const { mode, setMode } = useTheme();
  const version = installedVersion();
  const [checking, setChecking] = useState(true);
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  async function check() {
    setChecking(true);
    setCheckError(null);
    try {
      setUpdate(await checkForUpdate());
    } catch (e) {
      setCheckError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    check();
  }, []);

  function confirmSignOut() {
    Alert.alert('Sair da conta', 'Deseja sair? Seus dados continuam salvos na nuvem.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => signOutAll().catch((e) => Alert.alert('Erro', e.message)),
      },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Section icon="theme-light-dark" title="Aparência" />
        <Muted>Tema do aplicativo</Muted>
        <View style={{ height: 8 }} />
        <Segmented<ThemeMode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'claro', label: 'Claro' },
            { value: 'escuro', label: 'Escuro' },
            { value: 'sistema', label: 'Automático' },
          ]}
        />
        <Muted>"Automático" segue o tema do celular.</Muted>
      </Card>

      <Card>
        <Section icon="cellphone-arrow-down" title="Atualização do app" />
        <Text style={{ color: colors.text }}>
          Versão instalada: <Text style={{ fontWeight: '700' }}>{version.versionName}</Text> (build {version.versionCode})
        </Text>
        <View style={{ marginVertical: 10 }}>
          {checking ? (
            <Row>
              <ActivityIndicator color={colors.primary} />
              <Muted>Procurando atualização...</Muted>
            </Row>
          ) : checkError ? (
            <Muted>Não foi possível verificar: {checkError}</Muted>
          ) : update ? (
            <Text style={{ color: colors.success, fontWeight: '700' }}>
              Nova versão {update.versionName} disponível!
            </Text>
          ) : (
            <Muted>Você está na versão mais recente.</Muted>
          )}
        </View>
        {update ? (
          <Button title={`Atualizar para ${update.versionName}`} onPress={() => router.push('/updates')} />
        ) : (
          <Button title="Verificar atualização" variant="outline" onPress={check} loading={checking} />
        )}
      </Card>

      {user && (
        <Card>
          <Section icon="account" title="Conta" />
          <Text style={{ color: colors.text }}>{user.displayName || 'Conectado'}</Text>
          {user.email ? <Muted>{user.email}</Muted> : null}
          <Muted>Seus veículos e manutenções ficam salvos no Firebase, ligados a esta conta.</Muted>
          <Button title="Sair da conta" variant="danger" onPress={confirmSignOut} style={{ marginTop: 12 }} />
        </Card>
      )}

      <Card>
        <Section icon="information-outline" title="Sobre" />
        <Muted>Meu Carro: manutenções, estética e diagnóstico OBD.</Muted>
        <Muted>Valores de referência: tabela FIPE. Fotos dos modelos: Wikipédia / Wikimedia Commons.</Muted>
      </Card>
    </Screen>
  );
}

function Section({ icon, title }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string }) {
  return (
    <Row style={{ marginBottom: 6 }}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      <Title>{title}</Title>
    </Row>
  );
}
