import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AppearancePicker } from '@/components/AppearancePicker';
import { CarArt } from '@/components/CarArt';
import { Badge, Button, Card, colors, Muted, NumberField, Row, Screen, Segmented, Title } from '@/components/ui';
import { deleteVehicle, getVehicle, listMaintenances, listMods, updateVehicle } from '@/lib/db';
import { formatBRL, formatKm, formatPlate, intToInput, isoToBr, parseNumber } from '@/lib/format';
import { buildPlan, intervalText, type DueLevel, type PlanItem } from '@/lib/maintenance';
import type { Maintenance, Mod, Vehicle } from '@/lib/types';
import { DEFAULT_COLOR, guessBody, type BodyType } from '@/lib/vehicleLook';

type Tab = 'plano' | 'historico' | 'estetica';

export default function VehicleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle>();
  const [items, setItems] = useState<Maintenance[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [kmText, setKmText] = useState('');
  const [savingKm, setSavingKm] = useState(false);
  const [tab, setTab] = useState<Tab>('plano');
  const [showHidden, setShowHidden] = useState(false);
  const [editLook, setEditLook] = useState<{ body: BodyType; color: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [v, m, md] = await Promise.all([getVehicle(id), listMaintenances(id), listMods(id)]);
      setVehicle(v);
      setItems(m);
      setMods(md);
      setKmText(intToInput(v.current_km));
    } catch (e) {
      Alert.alert('Erro ao carregar', (e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const plan = useMemo(() => (vehicle ? buildPlan(vehicle, items) : []), [items, vehicle]);
  const visible = plan.filter((p) => !p.off);
  const hidden = plan.filter((p) => p.off);
  const overdue = visible.filter((p) => p.level === 'vencida').length;
  const soon = visible.filter((p) => p.level === 'proxima').length;
  const toDefine = visible.filter((p) => p.level === 'definir').length;
  const maintCost = items.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const modsCost = mods.filter((m) => m.status === 'feito').reduce((sum, m) => sum + (m.cost ?? 0), 0);

  const body = vehicle?.body ?? (vehicle ? guessBody(vehicle.model) : 'hatch');
  const color = vehicle?.color ?? DEFAULT_COLOR;

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

  async function saveLook() {
    if (!vehicle || !editLook) return;
    try {
      await updateVehicle(vehicle.id, editLook);
      setVehicle({ ...vehicle, ...editLook });
      setEditLook(null);
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  }

  function confirmDelete() {
    Alert.alert('Excluir veículo', 'Isso apaga o veículo, o histórico e os itens de estética. Continuar?', [
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
        <Pressable onPress={() => setEditLook({ body, color })} style={{ alignItems: 'center' }}>
          <CarArt body={body} color={color} width={280} />
          <Text style={{ color: colors.primary, fontSize: 12, marginTop: -4 }}>Trocar desenho / cor</Text>
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 8 }}>
          {formatPlate(vehicle.plate)}
        </Text>
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
            <NumberField kind="int" label="Quilometragem atual" value={kmText} onChangeText={setKmText} />
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
          title="+ Registrar manutenção"
          style={{ flex: 1 }}
          onPress={() => router.push(`/vehicle/${vehicle.id}/maintenance`)}
        />
        <Button
          title="OBD"
          variant="outline"
          style={{ paddingHorizontal: 20 }}
          onPress={() => router.push(`/vehicle/${vehicle.id}/obd`)}
        />
      </Row>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'plano', label: 'Manutenções' },
          { value: 'historico', label: 'Histórico' },
          { value: 'estetica', label: 'Estética' },
        ]}
      />

      {tab === 'plano' && (
        <Card>
          <Title>Plano de manutenção</Title>
          <Muted>
            {overdue ? `${overdue} vencida(s) · ` : ''}
            {soon ? `${soon} em breve · ` : ''}
            {toDefine ? `${toDefine} para definir · ` : ''}
            Toque num item para informar o km ou a data da próxima troca.
          </Muted>
          <View style={{ height: 8 }} />
          {visible.map((p) => (
            <PlanRow key={p.type.id} p={p} onPress={() => router.push(`/vehicle/${vehicle.id}/plan?t=${p.type.id}`)} />
          ))}
          {hidden.length > 0 && (
            <Pressable onPress={() => setShowHidden(!showHidden)} style={{ paddingTop: 12 }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {showHidden ? 'Esconder' : 'Mostrar'} itens que não se aplicam ({hidden.length})
              </Text>
            </Pressable>
          )}
          {showHidden &&
            hidden.map((p) => (
              <PlanRow key={p.type.id} p={p} onPress={() => router.push(`/vehicle/${vehicle.id}/plan?t=${p.type.id}`)} />
            ))}
        </Card>
      )}

      {tab === 'historico' && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Title>Histórico</Title>
            <Muted>Total: {formatBRL(maintCost)}</Muted>
          </Row>
          {items.length === 0 ? (
            <Muted>Nenhuma manutenção registrada. Use "+ Registrar manutenção" para adicionar uma preventiva ou corretiva.</Muted>
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
                <Row style={{ marginTop: 2 }}>
                  <Badge
                    text={m.kind === 'corretiva' ? 'Corretiva' : 'Preventiva'}
                    color={m.kind === 'corretiva' ? colors.danger : colors.primary}
                  />
                  <Muted>
                    {isoToBr(m.date)} · {formatKm(m.km)}
                    {m.workshop ? ` · ${m.workshop}` : ''}
                  </Muted>
                </Row>
                {m.description ? <Muted>{m.description}</Muted> : null}
              </Pressable>
            ))
          )}
        </Card>
      )}

      {tab === 'estetica' && (
        <>
          <Button
            title="+ Adicionar item de estética"
            variant="outline"
            onPress={() => router.push(`/vehicle/${vehicle.id}/mod`)}
            style={{ marginBottom: 12 }}
          />
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Title>Estética e modificações</Title>
              <Muted>Gasto: {formatBRL(modsCost)}</Muted>
            </Row>
            {mods.length === 0 ? (
              <Muted>
                Anote o que você trocou ou quer trocar: bancos, faróis, rodas, som, película, envelopamento...
              </Muted>
            ) : (
              mods.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => router.push(`/vehicle/${vehicle.id}/mod?modId=${m.id}`)}
                  style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}
                >
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>{m.title}</Text>
                    <Badge
                      text={m.status === 'feito' ? 'Feito' : 'Planejado'}
                      color={m.status === 'feito' ? colors.success : colors.warning}
                    />
                  </Row>
                  <Muted>
                    {[m.category, m.brand, m.date ? isoToBr(m.date) : null, m.cost != null ? formatBRL(m.cost) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Muted>
                </Pressable>
              ))
            )}
          </Card>
        </>
      )}

      <Button title="Excluir veículo" variant="danger" onPress={confirmDelete} style={{ marginTop: 8 }} />

      <Modal visible={!!editLook} animationType="slide" onRequestClose={() => setEditLook(null)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
          <Title>Desenho do veículo</Title>
          <Muted>Escolha o tipo de carroceria e a cor mais parecidos com o seu carro.</Muted>
          <View style={{ height: 12 }} />
          {editLook && <AppearancePicker body={editLook.body} color={editLook.color} onChange={setEditLook} />}
          <View style={{ height: 20 }} />
          <Button title="Salvar" onPress={saveLook} />
          <Button title="Cancelar" variant="outline" onPress={() => setEditLook(null)} style={{ marginTop: 8 }} />
        </ScrollView>
      </Modal>
    </Screen>
  );
}

const LEVEL: Record<DueLevel, { label: string; color: string }> = {
  vencida: { label: 'Vencida', color: colors.danger },
  proxima: { label: 'Em breve', color: colors.warning },
  ok: { label: 'Em dia', color: colors.success },
  definir: { label: 'Definir', color: colors.muted },
};

function PlanRow({ p, onPress }: { p: PlanItem; onPress: () => void }) {
  const lv = p.off ? { label: 'Não se aplica', color: colors.muted } : LEVEL[p.level];
  const next = [p.next_km != null ? formatKm(p.next_km) : null, p.next_date ? isoToBr(p.next_date) : null]
    .filter(Boolean)
    .join(' ou ');
  const left: string[] = [];
  if (p.kmLeft != null) left.push(p.kmLeft >= 0 ? `faltam ${formatKm(p.kmLeft)}` : `passou ${formatKm(-p.kmLeft)}`);
  if (p.daysLeft != null) left.push(p.daysLeft >= 0 ? `${p.daysLeft} dias` : `atrasada ${-p.daysLeft} dias`);

  return (
    <Pressable
      onPress={onPress}
      style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, opacity: p.off ? 0.6 : 1 }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '600', color: colors.text, flex: 1 }}>{p.type.name}</Text>
        <Badge text={lv.label} color={lv.color} />
      </Row>
      {next ? (
        <Muted>
          Próxima: {next}
          {left.length ? ` (${left.join(', ')})` : ''}
          {p.source === 'calculado' ? ' · calculada' : ''}
        </Muted>
      ) : (
        <Muted>Sugestão: {intervalText(p.type)} · toque para informar</Muted>
      )}
      {p.last && (
        <Muted>
          Última: {isoToBr(p.last.date)} · {formatKm(p.last.km)}
        </Muted>
      )}
    </Pressable>
  );
}
