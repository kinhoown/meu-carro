import { useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { Badge, Button, Card, colors, Muted, Screen, Title } from '@/components/ui';
import {
  checkForUpdate,
  cleanOldDownloads,
  downloadUpdate,
  fetchLatestRelease,
  formatSize,
  installApk,
  installedVersion,
  type AppUpdate,
} from '@/lib/updater';

type Phase = 'idle' | 'checking' | 'downloading' | 'ready';

export default function Updates() {
  const current = installedVersion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [latestName, setLatestName] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [apkPath, setApkPath] = useState<string | null>(null);

  async function check() {
    setPhase('checking');
    try {
      const u = await checkForUpdate();
      setUpdate(u);
      if (!u) setLatestName((await fetchLatestRelease())?.versionName ?? null);
      setChecked(true);
    } catch (e) {
      Alert.alert('Atualizações', (e as Error).message);
    } finally {
      setPhase('idle');
    }
  }

  useEffect(() => {
    cleanOldDownloads().catch(() => undefined);
    check();
  }, []);

  async function download() {
    if (!update) return;
    setPhase('downloading');
    setProgress(0);
    try {
      const path = await downloadUpdate(update, setProgress);
      setApkPath(path);
      setPhase('ready');
      await install(path);
    } catch (e) {
      setPhase('idle');
      Alert.alert('Erro no download', (e as Error).message);
    }
  }

  async function install(path = apkPath) {
    if (!path) return;
    try {
      await installApk(path);
    } catch {
      Alert.alert(
        'Permissão necessária',
        'Permita que o Meu Carro instale apps (Configurações > Apps > Meu Carro > Instalar apps desconhecidos) e toque em "Instalar" de novo.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
        ],
      );
    }
  }

  return (
    <Screen>
      <Card>
        <Title>Versão instalada</Title>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{current.versionName}</Text>
        <Muted>Build {current.versionCode}</Muted>
      </Card>

      {update ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title>Nova versão {update.versionName}</Title>
            <Badge text="Disponível" color={colors.success} />
          </View>
          <Muted>
            Publicada em {new Date(update.publishedAt).toLocaleDateString('pt-BR')} · {formatSize(update.apkSize)}
          </Muted>
          {update.notes ? (
            <View style={{ marginTop: 12, marginBottom: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>O que mudou</Text>
              <Text style={{ color: colors.text }}>{update.notes}</Text>
            </View>
          ) : null}

          {phase === 'downloading' && (
            <View style={{ marginTop: 12 }}>
              <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: colors.primary }} />
              </View>
              <Muted>Baixando... {Math.round(progress * 100)}%</Muted>
            </View>
          )}

          {phase === 'ready' ? (
            <Button title="Instalar" onPress={() => install()} style={{ marginTop: 12 }} />
          ) : (
            <Button
              title="Baixar e instalar"
              onPress={download}
              loading={phase === 'downloading'}
              style={{ marginTop: 12 }}
            />
          )}
          <View style={{ marginTop: 8 }}>
            <Muted>Seus dados ficam na nuvem e não são apagados ao atualizar.</Muted>
          </View>
        </Card>
      ) : (
        <Card>
          <Title>{checked ? 'Você está na versão mais recente' : 'Procurando atualizações...'}</Title>
          {checked && latestName ? <Muted>Última versão publicada: {latestName}</Muted> : null}
        </Card>
      )}

      <Button title="Procurar atualizações" variant="outline" onPress={check} loading={phase === 'checking'} />
    </Screen>
  );
}
