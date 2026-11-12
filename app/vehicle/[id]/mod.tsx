import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { SelectModal } from '@/components/SelectModal';
import { Button, Card, colors, Field, Muted, NumberField, Row, Screen, SelectField, Segmented } from '@/components/ui';
import { deleteMod, getMod, saveMod } from '@/lib/db';
import { brToIso, intToInput, isoToBr, maskDate, moneyToInput, parseNumber, todayIso } from '@/lib/format';
import type { ModStatus } from '@/lib/types';

const CATEGORIES = [
  'Bancos / interior',
  'Volante / painel',
  'Faróis / lanternas',
  'Iluminação (LED, xenon)',
  'Rodas',
  'Pneus',
  'Som / multimídia',
  'Película (insulfilm)',
  'Pintura / envelopamento',
  'Para-choques / kit visual',
  'Grade / emblemas',
  'Suspensão (rebaixamento)',
  'Escapamento esportivo',
  'Tapetes / capas',
  'Câmera / sensor de ré',
  'Acessórios',
  'Outro',
].map((c) => ({ value: c, label: c }));

export default function ModForm() {
  const { id, modId } = useLocalSearchParams<{ id: string; modId?: string }>();
  const editing = !!modId;
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const [status, setStatus] = useState<ModStatus>('feito');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [date, setDate] = useState(isoToBr(todayIso()));
  const [km, setKm] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!modId) return;
    getMod(modId)
      .then((m) => {
        setStatus(m.status);
        setCategory(m.category);
        setTitle(m.title);
        setBrand(m.brand ?? '');
        setDate(isoToBr(m.date));
        setKm(intToInput(m.km));
        setCost(moneyToInput(m.cost));
        setNotes(m.notes ?? '');
      })
      .catch((e) => Alert.alert('Erro', e.message))
      .finally(() => setLoading(false));
  }, [modId]);

  async function save() {
    const dateIso = date ? brToIso(date) : null;
    if (!category) return Alert.alert('Atenção', 'Escolha a categoria.');
    if (!title.trim()) return Alert.alert('Atenção', 'Descreva o que foi feito ou o que você quer fazer.');
    if (date && !dateIso) return Alert.alert('Atenção', 'Data inválida. Use dd/mm/aaaa.');
    const kmNum = parseNumber(km);

    setSaving(true);
    try {
      await saveMod(
        {
          vehicle_id: id,
          status,
          category,
          title: title.trim(),
          brand: brand.trim() || null,
          date: dateIso,
          km: kmNum != null ? Math.round(kmNum) : null,
          cost: parseNumber(cost),
          notes: notes.trim() || null,
        },
        modId,
      );
      router.back();
    } catch (e) {
      Alert.alert('Erro ao salvar', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Excluir item', 'Deseja excluir este item de estética?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMod(modId!);
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
      <Stack.Screen options={{ title: editing ? 'Editar estética' : 'Estética / modificação' }} />

      <Segmented<ModStatus>
        value={status}
        onChange={setStatus}
        options={[
          { value: 'feito', label: 'Já troquei / fiz' },
          { value: 'planejado', label: 'Vou trocar / fazer' },
        ]}
      />

      <Card>
        <SelectField label="Categoria" placeholder="Escolher" value={category} onPress={() => setPicking(true)} />
        <Field
          label={status === 'feito' ? 'O que foi feito' : 'O que você quer fazer'}
          placeholder="Ex.: Troquei os bancos por bancos de couro"
          value={title}
          onChangeText={setTitle}
        />
        <Field label="Marca / modelo da peça" placeholder="Ex.: Farol full LED Shocklight" value={brand} onChangeText={setBrand} />
        <Row>
          <Field
            label={status === 'feito' ? 'Data' : 'Previsão (opcional)'}
            placeholder="dd/mm/aaaa"
            value={date}
            onChangeText={(t) => setDate(maskDate(t))}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          <NumberField kind="int" label="Km (opcional)" value={km} onChangeText={setKm} containerStyle={{ flex: 1 }} />
        </Row>
        <NumberField
          kind="money"
          label={status === 'feito' ? 'Quanto custou (R$)' : 'Orçamento (R$)'}
          placeholder="0,00"
          value={cost}
          onChangeText={setCost}
        />
        <Field label="Observações" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70 }} />
        <Muted>Dica: use "Vou trocar" como lista de desejos e mude para "Já troquei" quando fizer.</Muted>
      </Card>

      <Button title="Salvar" onPress={save} loading={saving} />
      {editing && <Button title="Excluir" variant="danger" onPress={confirmDelete} style={{ marginTop: 12 }} />}

      <SelectModal
        visible={picking}
        title="Categoria"
        options={CATEGORIES}
        onClose={() => setPicking(false)}
        onSelect={(o) => {
          setPicking(false);
          setCategory(o.value);
        }}
      />
    </Screen>
  );
}
