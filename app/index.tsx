import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, colors, Muted, Screen, Title } from '@/components/ui';
import { VehicleImage } from '@/components/VehicleImage';
import { UpdateBanner } from '@/components/UpdateBanner';
import { installedVersion } from '@/lib/updater';
import { listVehicles } from '@/lib/db';
import { formatKm, formatPlate } from '@/lib/format';
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
            <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="Configurações">
              <MaterialCommunityIcons name="cog-outline" size={24} color={colors.text} />
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
              <View style={{ marginBottom: 8 }}>
                <VehicleImage
                  vehicle={v}
                  height={150}
                  onUpdated={(patch) =>
                    setVehicles((list) => list?.map((x) => (x.id === v.id ? { ...x, ...patch } : x)) ?? null)
                  }
                />
              </View>
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

      <Pressable onPress={() => router.push('/settings')} style={{ marginTop: 24, alignItems: 'center' }}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Configurações e atualizações</Text>
        <Muted>Versão {installedVersion().versionName}</Muted>
      </Pressable>
    </Screen>
  );
}
