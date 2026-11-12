import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { checkForUpdate, type AppUpdate } from '@/lib/updater';
import { colors } from './ui';

// Uma verificação por abertura do app é suficiente (a API do GitHub tem limite por IP).
let cached: Promise<AppUpdate | null> | null = null;

/** Faixa "Nova versão disponível" que leva para a tela de atualizações. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);

  useEffect(() => {
    cached ??= checkForUpdate().catch(() => null);
    cached.then(setUpdate);
  }, []);

  if (!update) return null;

  return (
    <Pressable
      onPress={() => router.push('/updates')}
      style={{
        backgroundColor: colors.success,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
        Nova versão {update.versionName} disponível
      </Text>
      <Text style={{ color: '#fff' }}>Toque para baixar e instalar</Text>
    </Pressable>
  );
}
