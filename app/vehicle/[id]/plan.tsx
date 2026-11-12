import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Text } from 'react-native';
import { Button, Card, colors, Field, Muted, NumberField, Row, Screen, Title } from '@/components/ui';
import { getVehicle, listMaintenances, setPlanEntry } from '@/lib/db';
import { brToIso, formatKm, intToInput, isoToBr, maskDate, parseNumber, todayIso } from '@/lib/format';
import { buildPlan, findTypeById, intervalText, nextFromLast, type PlanItem } from '@/lib/maintenance';
import type { Vehicle } from '@/lib/types';

/** Um item do plano: informar a próxima troca, registrar que fez, ou marcar que não se aplica. */
export default function PlanItemScreen() {
  const { id, t } = useLocalSearchParams<{ id: string; t: string }>();
  const type = findTypeById(t);
  const [vehicle, setVehicle] = useState<Vehicle>();
  const [item, setItem] = useState<PlanItem>();
  const [nextKm, setNextKm] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [v, hist] = await Promise.all([getVehicle(id), listMaintenances(id)]);
          const p = buildPlan(v, hist).find((x) => x.type.id === t);
          setVehicle(v);
          setItem(p);
          setNextKm(intToInput(p?.next_km));
          setNextDate(isoToBr(p?.next_date));
        } catch (e) {
          Alert.alert('Erro', (e as Error).message);
        }
      })();
    }, [id, t]),
  );

  /** Sugestão: a partir da última troca; se nunca registrou, a partir de hoje e do km atual. */
  function suggest() {
    if (!type || !vehicle) return;
    const base = item?.last ?? { km: vehicle.current_km, date: todayIso() };
    const s = nextFromLast(type, base);
    setNextKm(intToInput(s.next_km));
    setNextDate(isoToBr(s.next_date));
  }

  async function save(off?: boolean) {
    if (!type) return;
    const km = parseNumber(nextKm);
    const date = nextDate ? brToIso(nextDate) : null;
    if (nextDate && !date) return Alert.alert('Atenção', 'Data inválida. Use dd/mm/aaaa.');
    setSaving(true);
    try {
      await setPlanEntry(id, type.id, {
        next_km: km != null ? Math.round(km) : null,
        next_date: date,
        off: off ?? item?.off ?? false,
      });
      router.back();
    } catch (e) {
      Alert.alert('Erro ao salvar', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!type) return <Muted>Item não encontrado.</Muted>;
  if (!vehicle || !item) return <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: type.name }} />

      <Card>
        <Title>{type.name}</Title>
        <Muted>Recomendação geral: {intervalText(type)}. Confira o manual do seu carro.</Muted>
        <Text style={{ color: colors.text, marginTop: 8 }}>
          {item.last
            ? `Última vez: ${isoToBr(item.last.date)} com ${formatKm(item.last.km)}`
            : 'Ainda não há registro deste item.'}
        </Text>
        <Muted>Km atual do veículo: {formatKm(vehicle.current_km)}</Muted>
      </Card>

      <Card>
        <Title>Próxima troca</Title>
        <Muted>Preencha o km, a data, ou os dois (vale o que chegar primeiro).</Muted>
        <Row style={{ marginTop: 8 }}>
          <NumberField
            kind="int"
            label="No km"
            placeholder="60.000"
            value={nextKm}
            onChangeText={setNextKm}
            containerStyle={{ flex: 1 }}
          />
          <Field
            label="Ou na data"
            placeholder="dd/mm/aaaa"
            value={nextDate}
            onChangeText={(x) => setNextDate(maskDate(x))}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
        </Row>
        <Button title="Usar a sugestão" variant="outline" onPress={suggest} />
      </Card>

      <Button title="Salvar" onPress={() => save()} loading={saving} />
      <Button
        title="Registrar que já fiz"
        variant="outline"
        style={{ marginTop: 12 }}
        onPress={() =>
          router.replace(`/vehicle/${id}/maintenance?type=${encodeURIComponent(type.name)}&kind=preventiva`)
        }
      />
      <Button
        title={item.off ? 'Voltar a mostrar no plano' : 'Não se aplica ao meu carro'}
        variant="outline"
        style={{ marginTop: 12 }}
        onPress={() => save(!item.off)}
      />
    </Screen>
  );
}
