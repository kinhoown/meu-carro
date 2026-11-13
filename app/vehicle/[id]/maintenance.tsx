import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { SelectModal } from '@/components/SelectModal';
import { Button, Card, colors, Field, Muted, NumberField, Row, Screen, SelectField, Segmented } from '@/components/ui';
import {
  deleteMaintenance,
  getMaintenance,
  getVehicle,
  listMaintenances,
  saveMaintenance,
  setPlanEntry,
  updateVehicle,
} from '@/lib/db';
import {
  brToIso,
  intToInput,
  isoToBr,
  maskDate,
  moneyToInput,
  parseNumber,
  todayIso,
} from '@/lib/format';
import { CORRECTIVE_TYPES, findType, MAINTENANCE_TYPES, nextFromLast, OTHER } from '@/lib/maintenance';
import { iconForName } from '@/lib/icons';
import type { MaintenanceKind, Vehicle } from '@/lib/types';

const OPTIONS: Record<MaintenanceKind, { value: string; label: string }[]> = {
  preventiva: [...MAINTENANCE_TYPES.map((t) => t.name), OTHER].map((n) => ({
    value: n,
    label: n,
    icon: iconForName(n, findType(n)?.id),
  })),
  corretiva: [...CORRECTIVE_TYPES, OTHER].map((n) => ({ value: n, label: n, icon: iconForName(n) })),
};

export default function MaintenanceForm() {
  const params = useLocalSearchParams<{ id: string; mid?: string; type?: string; kind?: MaintenanceKind }>();
  const { id, mid } = params;
  const editing = !!mid;

  const [vehicle, setVehicle] = useState<Vehicle>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const [kind, setKind] = useState<MaintenanceKind>(params.kind === 'corretiva' ? 'corretiva' : 'preventiva');
  const [type, setType] = useState(params.type ?? '');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(isoToBr(todayIso()));
  const [km, setKm] = useState('');
  const [cost, setCost] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [notes, setNotes] = useState('');
  const [nextKm, setNextKm] = useState('');
  const [nextDate, setNextDate] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const v = await getVehicle(id);
        setVehicle(v);
        if (mid) {
          const m = await getMaintenance(mid);
          setKind(m.kind ?? 'preventiva');
          setType(m.type);
          setDescription(m.description ?? '');
          setDate(isoToBr(m.date));
          setKm(intToInput(m.km));
          setCost(moneyToInput(m.cost));
          setWorkshop(m.workshop ?? '');
          setNotes(m.notes ?? '');
          setNextKm(intToInput(m.next_km));
          setNextDate(isoToBr(m.next_date));
        } else {
          setKm(intToInput(v.current_km));
          if (params.type) suggestNext(params.type, intToInput(v.current_km));
        }
      } catch (e) {
        Alert.alert('Erro', (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mid]);

  /** Ao escolher o tipo, sugere a próxima troca com base no intervalo padrão. */
  function suggestNext(typeName: string, kmText = km, dateText = date) {
    const t = findType(typeName);
    const baseKm = parseNumber(kmText);
    const baseDate = brToIso(dateText);
    if (!t || baseKm == null || !baseDate) return;
    const s = nextFromLast(t, { km: baseKm, date: baseDate });
    setNextKm(intToInput(s.next_km));
    setNextDate(isoToBr(s.next_date));
  }

  async function save() {
    const dateIso = brToIso(date);
    const kmNum = parseNumber(km);
    const preventive = kind === 'preventiva';
    const nextDateIso = preventive && nextDate ? brToIso(nextDate) : null;
    const nextKmNum = preventive ? parseNumber(nextKm) : null;
    if (!type) return Alert.alert('Atenção', 'Escolha o que foi feito.');
    if (!dateIso) return Alert.alert('Atenção', 'Data inválida. Use dd/mm/aaaa.');
    if (kmNum == null) return Alert.alert('Atenção', 'Informe a quilometragem.');
    if (preventive && nextDate && !nextDateIso) return Alert.alert('Atenção', 'Data da próxima troca inválida.');

    setSaving(true);
    try {
      await saveMaintenance(
        {
          vehicle_id: id,
          kind,
          type,
          description: description.trim() || null,
          date: dateIso,
          km: Math.round(kmNum),
          cost: parseNumber(cost),
          workshop: workshop.trim() || null,
          notes: notes.trim() || null,
          next_km: nextKmNum != null ? Math.round(nextKmNum) : null,
          next_date: nextDateIso,
        },
        mid,
      );

      // Se for a troca mais recente desse item, ela passa a definir a próxima no plano.
      const t = findType(type);
      if (preventive && t) {
        const others = (await listMaintenances(id)).filter(
          (m) => m.type === type && m.id !== mid && m.kind !== 'corretiva',
        );
        const isLatest = others.every((m) => m.date < dateIso || (m.date === dateIso && m.km <= kmNum));
        if (isLatest) {
          const fallback = nextFromLast(t, { km: Math.round(kmNum), date: dateIso });
          await setPlanEntry(id, t.id, {
            next_km: nextKmNum != null ? Math.round(nextKmNum) : fallback.next_km,
            next_date: nextDateIso ?? (nextKmNum != null ? null : fallback.next_date),
            off: false,
          });
        }
      }

      // Mantém o hodômetro do veículo atualizado se a manutenção tiver km maior.
      if (vehicle && kmNum > vehicle.current_km) {
        await updateVehicle(vehicle.id, { current_km: Math.round(kmNum) });
      }
      router.back();
    } catch (e) {
      Alert.alert('Erro ao salvar', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Excluir manutenção', 'Deseja excluir este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMaintenance(mid!);
            router.back();
          } catch (e) {
            Alert.alert('Erro', (e as Error).message);
          }
        },
      },
    ]);
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Editar manutenção' : 'Registrar manutenção' }} />

      <Segmented<MaintenanceKind>
        value={kind}
        onChange={(k) => {
          setKind(k);
          if (!OPTIONS[k].some((o) => o.value === type)) setType('');
        }}
        options={[
          { value: 'preventiva', label: 'Preventiva' },
          { value: 'corretiva', label: 'Corretiva' },
        ]}
      />
      <Muted>
        {kind === 'preventiva'
          ? 'Revisões e trocas programadas (óleo, filtros, correia...).'
          : 'Conserto de algo que quebrou ou deu defeito.'}
      </Muted>
      <Card style={{ marginTop: 8 }}>
        <SelectField
          label={kind === 'preventiva' ? 'Item' : 'O que foi consertado'}
          placeholder="Escolher"
          value={type}
          onPress={() => setPicking(true)}
        />
        <Field
          label={kind === 'preventiva' ? 'Descrição (peças, marca, etc.)' : 'Qual foi o defeito / o que foi feito'}
          value={description}
          onChangeText={setDescription}
        />
        <Row>
          <Field
            label="Data"
            placeholder="dd/mm/aaaa"
            value={date}
            onChangeText={(t) => setDate(maskDate(t))}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          <NumberField kind="int" label="Km" value={km} onChangeText={setKm} containerStyle={{ flex: 1 }} />
        </Row>
        <NumberField kind="money" label="Valor (R$)" placeholder="0,00" value={cost} onChangeText={setCost} />
        <Field label="Oficina" value={workshop} onChangeText={setWorkshop} />
        <Field label="Observações" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70 }} />
      </Card>

      {kind === 'preventiva' && (
        <Card>
          <Muted>Próxima troca (sugerida pelo item; ajuste conforme o manual)</Muted>
          <Row style={{ marginTop: 8 }}>
            <NumberField kind="int" label="No km" value={nextKm} onChangeText={setNextKm} containerStyle={{ flex: 1 }} />
            <Field
              label="Ou na data"
              placeholder="dd/mm/aaaa"
              value={nextDate}
              onChangeText={(t) => setNextDate(maskDate(t))}
              keyboardType="number-pad"
              containerStyle={{ flex: 1 }}
            />
          </Row>
          {findType(type) ? (
            <Button title="Recalcular sugestão" variant="outline" onPress={() => suggestNext(type)} />
          ) : null}
        </Card>
      )}

      <Button title="Salvar" onPress={save} loading={saving} />
      {editing && <Button title="Excluir" variant="danger" onPress={confirmDelete} style={{ marginTop: 12 }} />}

      <SelectModal
        visible={picking}
        title={kind === 'preventiva' ? 'Item de manutenção' : 'Tipo de conserto'}
        options={OPTIONS[kind]}
        onClose={() => setPicking(false)}
        onSelect={(o) => {
          setPicking(false);
          setType(o.value);
          if (kind === 'preventiva') suggestNext(o.value);
        }}
      />
    </Screen>
  );
}
