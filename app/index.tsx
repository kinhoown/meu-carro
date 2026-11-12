import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, colors, Muted, Screen, Title } from '@/components/ui';
import { UpdateBanner } from '@/components/UpdateBanner';
import { installedVersion } from '@/lib/updater';
import { listVehicles } from '@/lib/db';
import { formatKm, formatPlate } from '@/lib/format';
import { signOutAll } from '@/lib/google';
import type { Vehicle } from '@/lib/types';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      listVehicles()
        .then(setVehicles)
        .catch((e) => {
          setVehicles([]);
          Alert.alert('Erro ao carregar', e.message);
        });
    }, []),
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => signOutAll().catch((e) => Alert.alert('Erro', e.message))} hitSlop={12}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Sair</Text>
            </Pressable>
          ),
        }}
      />

      <UpdateBanner />

      {vehicles === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : vehicles.length === 0 ? (
        <Card>
          <Title>Nenhum veículo ainda</Title>
          <Muted>Cadastre seu carro pela placa e escolha o modelo na tabela FIPE.</Muted>
        </Card>
      ) : (
        vehicles.map((v) => (
          <Pressable key={v.id} onPress={() => router.push(`/vehicle/${v.id}`)}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                  {v.nickname || formatPlate(v.plate)}
                </Text>
                <Text style={{ color: colors.muted, fontWeight: '700' }}>{formatPlate(v.plate)}</Text>
              </View>
              <Text style={{ color: colors.text, marginTop: 4 }}>
                {v.brand} {v.model} {v.year_model && v.year_model < 32000 ? v.year_model : ''}
              </Text>
              <Muted>{formatKm(v.current_km)}</Muted>
            </Card>
          </Pressable>
        ))
      )}

      <Button title="+ Adicionar veículo" onPress={() => router.push('/vehicle/new')} />

      <Pressable onPress={() => router.push('/updates')} style={{ marginTop: 24, alignItems: 'center' }}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Atualizações do app</Text>
        <Muted>Versão {installedVersion().versionName}</Muted>
      </Pressable>
    </Screen>
  );
}
