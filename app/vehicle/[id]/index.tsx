import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, colors, Field, Muted, Row, Screen, Title } from '@/components/ui';
import { deleteVehicle, getVehicle, listMaintenances, updateVehicle } from '@/lib/db';
import { formatBRL, formatKm, formatPlate, isoToBr, parseNumber } from '@/lib/format';
import { buildReminders, type Reminder } from '@/lib/maintenance';
import type { Maintenance, Vehicle } from '@/lib/types';

export default function VehicleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle>();
  const [items, setItems] = useState<Maintenance[]>([]);
  const [kmText, setKmText] = useState('');
  const [savingKm, setSavingKm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, m] = await Promise.all([getVehicle(id), listMaintenances(id)]);
      setVehicle(v);
      setItems(m);
      setKmText(String(v.current_km));
    } catch (e) {
      Alert.alert('Erro ao carregar', (e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const reminders = useMemo(
    () => (vehicle ? buildReminders(items, vehicle.current_km) : []),
    [items, vehicle],
  );
  const totalCost = items.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  async function saveKm() {
    const km = parseNumber(kmText);
    if (km == null || !vehicle) return;
    setSavingKm(true);
    try {
      await updateVehicle(vehicle.id, { current_km: Math.round(km) });
      setVehicle({ ...vehicle, current_km: Math.round(km) });
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    } finally {
      setSavingKm(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Excluir veículo', 'Isso apaga o veículo e todo o histórico de manutenções. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVehicle(id);
            router.back();
          } catch (e) {
            Alert.alert('Erro', (e as Error).message);
          }
        },
      },
    ]);
  }

  if (!vehicle) return <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: vehicle.nickname || formatPlate(vehicle.plate) }} />

      <Card>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{formatPlate(vehicle.plate)}</Text>
        <Text style={{ color: colors.text, marginTop: 2 }}>
          {vehicle.brand} {vehicle.model}
        </Text>
        <Muted>
          {[vehicle.year_model, vehicle.fuel].filter(Boolean).join(' · ')}
          {vehicle.fipe_value ? ` · FIPE ${vehicle.fipe_value}` : ''}
        </Muted>
        {vehicle.vin && <Muted>Chassi: {vehicle.vin}</Muted>}

        <Row style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Quilometragem atual" value={kmText} onChangeText={setKmText} keyboardType="numeric" />
          </View>
          <Button
            title="Salvar"
            variant="outline"
            onPress={saveKm}
            loading={savingKm}
            disabled={parseNumber(kmText) === vehicle.current_km}
            style={{ marginBottom: 12 }}
          />
        </Row>
      </Card>

      <Row style={{ marginBottom: 12 }}>
        <Button
          title="+ Manutenção"
          style={{ flex: 1 }}
          onPress={() => router.push(`/vehicle/${vehicle.id}/maintenance`)}
        />
        <Button
          title="Diagnóstico OBD"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => router.push(`/vehicle/${vehicle.id}/obd`)}
        />
      </Row>

      <Card>
        <Title>Próximas manutenções</Title>
        {reminders.length === 0 ? (
          <Muted>Registre manutenções com "próxima troca" para ver os lembretes aqui.</Muted>
        ) : (
          reminders.map((r) => <ReminderRow key={r.maintenance.id} r={r} />)
        )}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Title>Histórico</Title>
          <Muted>Total: {formatBRL(totalCost)}</Muted>
        </Row>
        {items.length === 0 ? (
          <Muted>Nenhuma manutenção registrada.</Muted>
        ) : (
          items.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => router.push(`/vehicle/${vehicle.id}/maintenance?mid=${m.id}`)}
              style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>{m.type}</Text>
                <Text style={{ color: colors.text }}>{formatBRL(m.cost)}</Text>
              </Row>
              <Muted>
                {isoToBr(m.date)} · {formatKm(m.km)}
                {m.workshop ? ` · ${m.workshop}` : ''}
              </Muted>
              {m.description ? <Muted>{m.description}</Muted> : null}
            </Pressable>
          ))
        )}
      </Card>

      <Button title="Excluir veículo" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

function ReminderRow({ r }: { r: Reminder }) {
  const color = r.level === 'vencida' ? colors.danger : r.level === 'proxima' ? colors.warning : colors.success;
  const label = r.level === 'vencida' ? 'Vencida' : r.level === 'proxima' ? 'Em breve' : 'Em dia';
  const parts: string[] = [];
  if (r.kmLeft != null) parts.push(r.kmLeft >= 0 ? `faltam ${formatKm(r.kmLeft)}` : `passou ${formatKm(-r.kmLeft)}`);
  if (r.daysLeft != null) parts.push(r.daysLeft >= 0 ? `${r.daysLeft} dias` : `atrasada ${-r.daysLeft} dias`);

  return (
    <View style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '600', color: colors.text, flex: 1 }}>{r.maintenance.type}</Text>
        <Badge text={label} color={color} />
      </Row>
      <Muted>
        {[r.maintenance.next_km != null ? `em ${formatKm(r.maintenance.next_km)}` : null, r.maintenance.next_date ? `até ${isoToBr(r.maintenance.next_date)}` : null]
          .filter(Boolean)
          .join(' ou ')}
        {parts.length ? ` (${parts.join(', ')})` : ''}
      </Muted>
    </View>
  );
}
