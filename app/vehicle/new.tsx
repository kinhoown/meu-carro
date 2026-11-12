import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { AppearancePicker } from '@/components/AppearancePicker';
import { SelectModal, type Option } from '@/components/SelectModal';
import { Button, Card, colors, Field, Muted, NumberField, Screen, SelectField, Title } from '@/components/ui';
import { createVehicle } from '@/lib/db';
import { getBrands, getDetail, getModels, getYears, type FipeDetail, type FipeItem } from '@/lib/fipe';
import { formatPlate, isValidPlate, normalizePlate, parseNumber } from '@/lib/format';
import { DEFAULT_COLOR, guessBody, type BodyType } from '@/lib/vehicleLook';

type Step = 'brand' | 'model' | 'year';

const toOptions = (items: FipeItem[]): Option[] => items.map((i) => ({ value: i.codigo, label: i.nome }));

/** A FIPE usa 32000 para veículos "Zero KM". */
const ZERO_KM = 32000;

export default function NewVehicle() {
  const [plate, setPlate] = useState('');
  const [nickname, setNickname] = useState('');
  const [km, setKm] = useState('');
  const [look, setLook] = useState<{ body: BodyType; color: string }>({ body: 'hatch', color: DEFAULT_COLOR });
  const [lookTouched, setLookTouched] = useState(false);

  const [brand, setBrand] = useState<Option>();
  const [model, setModel] = useState<Option>();
  const [year, setYear] = useState<Option>();
  const [detail, setDetail] = useState<FipeDetail>();

  const [picker, setPicker] = useState<Step | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  async function openPicker(step: Step) {
    setPicker(step);
    setOptions([]);
    setLoadingOptions(true);
    try {
      const items =
        step === 'brand'
          ? await getBrands()
          : step === 'model'
            ? await getModels(brand!.value)
            : await getYears(brand!.value, model!.value);
      setOptions(toOptions(items));
    } catch (e) {
      setPicker(null);
      Alert.alert('Tabela FIPE', (e as Error).message);
    } finally {
      setLoadingOptions(false);
    }
  }

  async function onPick(o: Option) {
    const step = picker;
    setPicker(null);
    if (step === 'brand') {
      setBrand(o);
      setModel(undefined);
      setYear(undefined);
      setDetail(undefined);
    } else if (step === 'model') {
      setModel(o);
      if (!lookTouched) setLook((l) => ({ ...l, body: guessBody(o.label) }));
      setYear(undefined);
      setDetail(undefined);
    } else if (step === 'year') {
      setYear(o);
      try {
        setDetail(await getDetail(brand!.value, model!.value, o.value));
      } catch (e) {
        Alert.alert('Tabela FIPE', (e as Error).message);
      }
    }
  }

  async function save() {
    const p = normalizePlate(plate);
    if (!isValidPlate(p)) return Alert.alert('Placa inválida', 'Use o formato ABC1234 ou ABC1D23.');
    if (!brand || !model || !year) return Alert.alert('Atenção', 'Escolha marca, modelo e ano.');

    const yearModel = detail?.AnoModelo ?? parseInt(year.label, 10);
    setSaving(true);
    try {
      const v = await createVehicle({
        plate: p,
        nickname: nickname.trim() || null,
        brand: detail?.Marca ?? brand.label,
        model: detail?.Modelo ?? model.label,
        year_model: yearModel === ZERO_KM ? new Date().getFullYear() : Number.isFinite(yearModel) ? yearModel : null,
        fuel: detail?.Combustivel ?? null,
        fipe_code: detail?.CodigoFipe ?? null,
        fipe_value: detail?.Valor ?? null,
        fipe_ref: detail?.MesReferencia?.trim() ?? null,
        vin: null,
        current_km: Math.round(parseNumber(km) ?? 0),
        body: look.body,
        color: look.color,
      });
      router.replace(`/vehicle/${v.id}`);
    } catch (e) {
      Alert.alert('Erro ao salvar', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Field
          label="Placa"
          placeholder="ABC1D23"
          value={formatPlate(plate)}
          onChangeText={(t) => setPlate(normalizePlate(t))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
        />
        <Field label="Apelido (opcional)" placeholder="Ex.: Carro da família" value={nickname} onChangeText={setNickname} />
        <NumberField kind="int" label="Quilometragem atual" placeholder="45.000" value={km} onChangeText={setKm} />
      </Card>

      <Card>
        <Title>Modelo (tabela FIPE)</Title>
        <SelectField label="Marca" placeholder="Escolher marca" value={brand?.label} onPress={() => openPicker('brand')} />
        <SelectField
          label="Modelo"
          placeholder="Escolher modelo"
          value={model?.label}
          disabled={!brand}
          onPress={() => openPicker('model')}
        />
        <SelectField
          label="Ano / combustível"
          placeholder="Escolher ano"
          value={year?.label}
          disabled={!model}
          onPress={() => openPicker('year')}
        />
        {detail && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Valor FIPE: {detail.Valor}</Text>
            <Muted>
              Código {detail.CodigoFipe} · {detail.MesReferencia?.trim()}
            </Muted>
          </>
        )}
      </Card>

      <Card>
        <Title>Aparência</Title>
        <Muted>O tipo é sugerido pelo modelo. Escolha a cor do seu carro.</Muted>
        <AppearancePicker
          body={look.body}
          color={look.color}
          onChange={(v) => {
            setLookTouched(true);
            setLook(v);
          }}
        />
      </Card>

      <Button title="Salvar veículo" onPress={save} loading={saving} />

      <SelectModal
        visible={picker !== null}
        title={picker === 'brand' ? 'Marca' : picker === 'model' ? 'Modelo' : 'Ano'}
        options={options}
        loading={loadingOptions}
        onSelect={onPick}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}
