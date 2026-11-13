import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AppearancePicker } from './AppearancePicker';
import { Button, colors, Field, Muted, Row, Segmented, Title } from './ui';
import { photoOptions, photoQuery, WIKI_HEADERS, type PhotoCandidate } from '@/lib/carPhoto';
import { updateVehicle } from '@/lib/db';
import type { Vehicle } from '@/lib/types';
import { DEFAULT_COLOR, guessBody, type BodyType } from '@/lib/vehicleLook';

type Tab = 'foto' | 'desenho';

/** Trocar a imagem do veículo: escolher outra foto do modelo ou usar o desenho. */
export function VehicleImageEditor({
  vehicle,
  visible,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle;
  visible: boolean;
  onClose: () => void;
  onSaved: (patch: Partial<Vehicle>) => void;
}) {
  const [tab, setTab] = useState<Tab>(vehicle.photo_mode === 'desenho' ? 'desenho' : 'foto');
  const defaultQuery = `${photoQuery(vehicle.brand, vehicle.model)}${vehicle.year_model ? ` ${vehicle.year_model}` : ''}`;
  const [query, setQuery] = useState(defaultQuery);
  const [options, setOptions] = useState<PhotoCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  // Reabre sempre com a busca padrão (ano incluído).
  useEffect(() => {
    if (visible) setQuery((q) => q || defaultQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const [look, setLook] = useState<{ body: BodyType; color: string }>({
    body: vehicle.body ?? guessBody(vehicle.model),
    color: vehicle.color ?? DEFAULT_COLOR,
  });

  async function search(custom?: string) {
    setLoading(true);
    try {
      setOptions(await photoOptions(vehicle.brand, vehicle.model, vehicle.year_model, custom));
    } catch (e) {
      setOptions([]);
      Alert.alert('Busca de fotos', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible && tab === 'foto' && options === null) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tab]);

  async function save(patch: Partial<Vehicle>) {
    try {
      await updateVehicle(vehicle.id, patch);
      onSaved(patch);
      onClose();
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Title>Imagem do veículo</Title>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Fechar</Text>
          </Pressable>
        </Row>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'foto', label: 'Foto do modelo' },
            { value: 'desenho', label: 'Desenho' },
          ]}
        />

        {tab === 'foto' ? (
          <>
            <Muted>Toque na foto que mais se parece com o seu carro (mesmo modelo e geração).</Muted>
            <Row style={{ alignItems: 'flex-end', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Field label="Buscar por" value={query} onChangeText={setQuery} onSubmitEditing={() => search(query)} />
              </View>
              <Button title="Buscar" variant="outline" onPress={() => search(query)} style={{ marginBottom: 12 }} />
            </Row>
            <Muted>
              Digite o modelo e, se quiser, o ano e a versão. Ex.: "Onix LTZ 2016", "Gol G5", "Palio Weekend 2012".
              {options ? ` ${options.length} foto(s) encontrada(s).` : ''}
            </Muted>
            <View style={{ height: 12 }} />

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : options && options.length === 0 ? (
              <Muted>Nenhuma foto encontrada. Tente outro nome ou use o desenho.</Muted>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {options?.map((o) => {
                  const on = o.url === vehicle.photo_url && vehicle.photo_mode !== 'desenho';
                  return (
                    <Pressable
                      key={o.url}
                      onPress={() => save({ photo_url: o.url, photo_title: o.title, photo_mode: 'foto', photo_v: 0 })}
                      style={{
                        width: '48%',
                        borderRadius: 10,
                        overflow: 'hidden',
                        borderWidth: on ? 3 : 1,
                        borderColor: on ? colors.primary : colors.border,
                        backgroundColor: colors.card,
                      }}
                    >
                      <Image
                        source={{ uri: o.url, headers: WIKI_HEADERS }}
                        style={{ width: '100%', height: 100, backgroundColor: colors.chip }}
                        resizeMode="cover"
                      />
                      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, padding: 6 }}>
                        {o.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <Muted>Escolha o tipo de carroceria e a cor.</Muted>
            <View style={{ height: 12 }} />
            <AppearancePicker body={look.body} color={look.color} onChange={setLook} />
            <View style={{ height: 20 }} />
            <Button title="Usar o desenho" onPress={() => save({ ...look, photo_mode: 'desenho' })} />
          </>
        )}
      </ScrollView>
    </Modal>
  );
}
