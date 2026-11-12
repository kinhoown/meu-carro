import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { SelectModal } from '@/components/SelectModal';
import { Button, Card, colors, Field, Muted, Row, Screen, SelectField } from '@/components/ui';
import { deleteMaintenance, getMaintenance, getVehicle, saveMaintenance, updateVehicle } from '@/lib/db';
import { addMonthsIso, brToIso, isoToBr, maskDate, parseNumber, todayIso } from '@/lib/format';
import { findType, MAINTENANCE_TYPES } from '@/lib/maintenance';
import type { Vehicle } from '@/lib/types';

const typeOptions = MAINTENANCE_TYPES.map((t) => ({ value: t.name, label: t.name }));

export default function MaintenanceForm() {
  const { id, mid } = useLocalSearchParams<{ id: string; mid?: string }>();
  const editing = !!mid;

  const [vehicle, setVehicle] = useState<Vehicle>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const [type, setType] = useState('');
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
          setType(m.type);
          setDescription(m.description ?? '');
          setDate(isoToBr(m.date));
          setKm(String(m.km));
          setCost(m.cost != null ? String(m.cost).replace('.', ',') : '');
          setWorkshop(m.workshop ?? '');
          setNotes(m.notes ?? '');
          setNextKm(m.next_km != null ? String(m.next_km) : '');
          setNextDate(isoToBr(m.next_date));
        } else {
          setKm(String(v.current_km));
        }
      } catch (e) {
        Alert.alert('Erro', (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, mid]);

  /** Ao escolher o tipo, sugere a próxima troca com base no intervalo padrão. */
  function suggestNext(typeName: string, kmText = km, dateText = date) {
    const t = findType(typeName);
    if (!t) return;
    const baseKm = parseNumber(kmText);
    const baseDate = brToIso(dateText);
    setNextKm(t.km && baseKm != null ? String(Math.round(baseKm + t.km)) : '');
    setNextDate(t.months && baseDate ? isoToBr(addMonthsIso(baseDate, t.months)) : '');
  }

  async function save() {
    const dateIso = brToIso(date);
    const kmNum = parseNumber(km);
    const nextDateIso = nextDate ? brToIso(nextDate) : null;
    if (!type) return Alert.alert('Atenção', 'Escolha o tipo de manutenção.');
    if (!dateIso) return Alert.alert('Atenção', 'Data inválida. Use dd/mm/aaaa.');
    if (kmNum == null) return Alert.alert('Atenção', 'Informe a quilometragem.');
    if (nextDate && !nextDateIso) return Alert.alert('Atenção', 'Data da próxima troca inválida.');

    setSaving(true);
    try {
      await saveMaintenance(
        {
          vehicle_id: id,
          type,
          description: description.trim() || null,
          date: dateIso,
          km: Math.round(kmNum),
          cost: parseNumber(cost),
          workshop: workshop.trim() || null,
          notes: notes.trim() || null,
          next_km: nextKm ? Math.round(parseNumber(nextKm) ?? 0) || null : null,
          next_date: nextDateIso,
        },
        mid,
      );
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
      <Stack.Screen options={{ title: editing ? 'Editar manutenção' : 'Nova manutenção' }} />

      <Card>
        <SelectField label="Tipo" placeholder="Escolher tipo" value={type} onPress={() => setPicking(true)} />
        <Field label="Descrição (peças, marca, etc.)" value={description} onChangeText={setDescription} />
        <Row>
          <Field
            label="Data"
            placeholder="dd/mm/aaaa"
            value={date}
            onChangeText={(t) => setDate(maskDate(t))}
            keyboardType="numeric"
            containerStyle={{ flex: 1 }}
          />
          <Field label="Km" value={km} onChangeText={setKm} keyboardType="numeric" containerStyle={{ flex: 1 }} />
        </Row>
        <Field label="Valor (R$)" placeholder="0,00" value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
        <Field label="Oficina" value={workshop} onChangeText={setWorkshop} />
        <Field label="Observações" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70 }} />
      </Card>

      <Card>
        <Muted>Próxima troca (sugerida pelo tipo; ajuste conforme o manual)</Muted>
        <Row style={{ marginTop: 8 }}>
          <Field label="No km" value={nextKm} onChangeText={setNextKm} keyboardType="numeric" containerStyle={{ flex: 1 }} />
          <Field
            label="Ou na data"
            placeholder="dd/mm/aaaa"
            value={nextDate}
            onChangeText={(t) => setNextDate(maskDate(t))}
            keyboardType="numeric"
            containerStyle={{ flex: 1 }}
          />
        </Row>
        {type ? (
          <Button title="Recalcular sugestão" variant="outline" onPress={() => suggestNext(type)} />
        ) : null}
      </Card>

      <Button title="Salvar" onPress={save} loading={saving} />
      {editing && <Button title="Excluir" variant="danger" onPress={confirmDelete} style={{ marginTop: 12 }} />}

      <SelectModal
        visible={picking}
        title="Tipo de manutenção"
        options={typeOptions}
        onClose={() => setPicking(false)}
        onSelect={(o) => {
          setPicking(false);
          setType(o.value);
          suggestNext(o.value);
        }}
      />
    </Screen>
  );
}
