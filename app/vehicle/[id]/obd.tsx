import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, colors, Field, Muted, Row, Screen, Title } from '@/components/ui';
import { getVehicle, listObdSnapshots, saveObdSnapshot, updateVehicle } from '@/lib/db';
import { formatKm } from '@/lib/format';
import type { ObdSnapshot, Vehicle } from '@/lib/types';
import { scanBle, type BleDeviceInfo } from '@/obd/bleTransport';
import { listBondedDevices, type ClassicDevice } from '@/obd/classicTransport';
import { describeDtc } from '@/obd/dtc';
import { useObd } from '@/obd/ObdContext';
import { requestBluetoothPermissions } from '@/obd/permissions';
import { formatReading, PIDS } from '@/obd/pids';
import type { TransportKind } from '@/obd/transport';
import { DEFAULT_WIFI_HOST, DEFAULT_WIFI_PORT } from '@/obd/wifiTransport';

export default function ObdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const obd = useObd();
  const [vehicle, setVehicle] = useState<Vehicle>();
  const [snapshots, setSnapshots] = useState<ObdSnapshot[]>([]);

  const loadData = useCallback(() => {
    getVehicle(id).then(setVehicle).catch(() => undefined);
    listObdSnapshots(id).then(setSnapshots).catch(() => undefined);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => obd.stopLive();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadData]),
  );

  return (
    <Screen>
      {obd.status === 'conectado' ? (
        <Connected vehicle={vehicle} onSaved={loadData} onVehicleChange={setVehicle} />
      ) : (
        <ConnectPanel />
      )}

      {snapshots.length > 0 && (
        <Card>
          <Title>Últimas leituras salvas</Title>
          {snapshots.map((s) => (
            <View key={s.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {new Date(s.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
              <Muted>
                {s.dtcs.length ? `Códigos: ${s.dtcs.join(', ')}` : 'Sem códigos de falha'}
                {s.readings.odometer != null ? ` · ${formatKm(s.readings.odometer)}` : ''}
              </Muted>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Conexão
// ---------------------------------------------------------------------------

const TABS: { kind: TransportKind; label: string }[] = [
  { kind: 'classic', label: 'Bluetooth' },
  { kind: 'ble', label: 'BLE' },
  { kind: 'wifi', label: 'Wi-Fi' },
];

function ConnectPanel() {
  const obd = useObd();
  const [tab, setTab] = useState<TransportKind>('classic');
  const [bonded, setBonded] = useState<ClassicDevice[] | null>(null);
  const [bleDevices, setBleDevices] = useState<BleDeviceInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [host, setHost] = useState(DEFAULT_WIFI_HOST);
  const [port, setPort] = useState(String(DEFAULT_WIFI_PORT));
  const stopScan = useRef<(() => void) | null>(null);

  useEffect(() => () => stopScan.current?.(), []);

  async function loadBonded() {
    try {
      if (!(await requestBluetoothPermissions())) throw new Error('Permissão de Bluetooth negada.');
      setBonded(await listBondedDevices());
    } catch (e) {
      Alert.alert('Bluetooth', (e as Error).message);
    }
  }

  async function startScan() {
    try {
      if (!(await requestBluetoothPermissions())) throw new Error('Permissão de Bluetooth negada.');
      setBleDevices([]);
      setScanning(true);
      stopScan.current = await scanBle((d) =>
        setBleDevices((prev) => (prev.some((p) => p.id === d.id) ? prev : [...prev, d].sort(byLikelyObd))),
      );
      setTimeout(() => setScanning(false), 12000);
    } catch (e) {
      setScanning(false);
      Alert.alert('Bluetooth', (e as Error).message);
    }
  }

  const connecting = obd.status === 'conectando';

  return (
    <>
      <Card>
        <Title>Conectar ao adaptador OBD</Title>
        <Muted>Ligue a ignição do carro com o adaptador ELM327 encaixado na tomada OBD-II (embaixo do painel).</Muted>

        <Row style={{ marginVertical: 12 }}>
          {TABS.map((t) => (
            <Pressable
              key={t.kind}
              onPress={() => setTab(t.kind)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: tab === t.kind ? colors.primary : colors.bg,
              }}
            >
              <Text style={{ color: tab === t.kind ? '#fff' : colors.text, fontWeight: '700' }}>{t.label}</Text>
            </Pressable>
          ))}
        </Row>

        {tab === 'classic' && (
          <>
            <Muted>Pareie o adaptador antes nas configurações de Bluetooth do Android (PIN 1234 ou 0000).</Muted>
            <Button title="Listar pareados" variant="outline" onPress={loadBonded} style={{ marginTop: 8 }} />
            {bonded?.length === 0 && <Muted>Nenhum dispositivo pareado.</Muted>}
            {bonded?.map((d) => (
              <DeviceRow
                key={d.address}
                name={d.name}
                detail={d.address}
                disabled={connecting}
                onPress={() => obd.connect({ kind: 'classic', device: d })}
              />
            ))}
          </>
        )}

        {tab === 'ble' && (
          <>
            <Muted>Para adaptadores "BLE" ou "Bluetooth 4.0". Não precisa parear antes.</Muted>
            <Button
              title={scanning ? 'Procurando...' : 'Procurar dispositivos'}
              variant="outline"
              onPress={startScan}
              disabled={scanning}
              style={{ marginTop: 8 }}
            />
            {bleDevices.map((d) => (
              <DeviceRow
                key={d.id}
                name={d.name}
                detail={d.rssi != null ? `sinal ${d.rssi} dBm` : d.id}
                disabled={connecting}
                onPress={() => {
                  stopScan.current?.();
                  setScanning(false);
                  obd.connect({ kind: 'ble', device: d });
                }}
              />
            ))}
          </>
        )}

        {tab === 'wifi' && (
          <>
            <Muted>Conecte o celular na rede Wi-Fi do adaptador (ex.: "WiFi_OBDII") e volte aqui.</Muted>
            <Row style={{ marginTop: 8 }}>
              <Field label="IP" value={host} onChangeText={setHost} containerStyle={{ flex: 2 }} autoCapitalize="none" />
              <Field label="Porta" value={port} onChangeText={setPort} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            </Row>
            <Button
              title="Conectar"
              loading={connecting}
              onPress={() => obd.connect({ kind: 'wifi', host: host.trim(), port: Number(port) || DEFAULT_WIFI_PORT })}
            />
          </>
        )}

        {connecting && (
          <Row style={{ marginTop: 12 }}>
            <ActivityIndicator color={colors.primary} />
            <Muted>Conectando e detectando o protocolo do carro...</Muted>
          </Row>
        )}
        {obd.error && <Text style={{ color: colors.danger, marginTop: 12 }}>{obd.error}</Text>}
      </Card>
    </>
  );
}

function DeviceRow({
  name,
  detail,
  onPress,
  disabled,
}: {
  name: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        opacity: disabled ? 0.5 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: colors.text, fontWeight: '600' }}>{name}</Text>
      <Muted>{detail}</Muted>
    </Pressable>
  );
}

const OBD_NAME = /obd|elm|vlink|v-link|vgate|veepeak|konnwei|icar|ios-vlink|carista/i;
function byLikelyObd(a: BleDeviceInfo, b: BleDeviceInfo) {
  return Number(OBD_NAME.test(b.name)) - Number(OBD_NAME.test(a.name)) || (b.rssi ?? -999) - (a.rssi ?? -999);
}

// ---------------------------------------------------------------------------
// Conectado
// ---------------------------------------------------------------------------

function Connected({
  vehicle,
  onSaved,
  onVehicleChange,
}: {
  vehicle?: Vehicle;
  onSaved: () => void;
  onVehicleChange: (v: Vehicle) => void;
}) {
  const obd = useObd();
  const [dtcs, setDtcs] = useState<string[] | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [vin, setVin] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(name: string, fn: () => Promise<void>) {
    obd.stopLive();
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      Alert.alert('OBD', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const readDtcs = () =>
    run('dtc', async () => {
      const elm = obd.elm();
      if (!elm) return;
      setDtcs(await elm.readDtcs());
      setPending(await elm.readPendingDtcs());
    });

  const clearDtcs = () =>
    Alert.alert(
      'Apagar códigos de falha',
      'Isso apaga os códigos e a luz de injeção, e zera os monitores de emissões. Só faça depois de resolver o problema. Motor desligado e ignição ligada. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () =>
            run('clear', async () => {
              await obd.elm()?.clearDtcs();
              setDtcs([]);
              setPending([]);
            }),
        },
      ],
    );

  const readVin = () =>
    run('vin', async () => {
      const v = (await obd.elm()?.readVin()) ?? null;
      setVin(v);
      if (!v) Alert.alert('Chassi', 'Este carro não informou o chassi (VIN) pela OBD.');
      else if (vehicle && vehicle.vin !== v) {
        await updateVehicle(vehicle.id, { vin: v });
        onVehicleChange({ ...vehicle, vin: v });
      }
    });

  const saveSnapshot = () =>
    run('save', async () => {
      if (!vehicle) return;
      const readings = await obd.readOnce();
      const codes = dtcs ?? (await obd.elm()?.readDtcs()) ?? [];
      setDtcs(codes);
      await saveObdSnapshot({
        vehicle_id: vehicle.id,
        protocol: obd.protocol,
        vin: vin ?? vehicle.vin,
        dtcs: codes,
        readings,
      });

      const odo = readings.odometer;
      if (odo != null && odo > vehicle.current_km) {
        Alert.alert('Hodômetro', `O carro informou ${formatKm(odo)}. Atualizar a quilometragem do veículo?`, [
          { text: 'Não' },
          {
            text: 'Atualizar',
            onPress: async () => {
              await updateVehicle(vehicle.id, { current_km: Math.round(odo) });
              onVehicleChange({ ...vehicle, current_km: Math.round(odo) });
            },
          },
        ]);
      } else {
        Alert.alert('Salvo', 'Leitura salva no histórico.');
      }
      onSaved();
    }).catch(() => undefined);

  const shown = PIDS.filter((p) => obd.values[p.key] != null);

  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Title>Conectado</Title>
          <Badge text="Online" color={colors.success} />
        </Row>
        <Muted>{obd.label}</Muted>
        {obd.protocol ? <Muted>Protocolo: {obd.protocol}</Muted> : null}
        <Muted>{obd.available.length} sensores disponíveis neste carro</Muted>
        <Button title="Desconectar" variant="outline" onPress={obd.disconnect} style={{ marginTop: 12 }} />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Title>Dados do motor</Title>
          {obd.live && <Badge text="Ao vivo" color={colors.primary} />}
        </Row>
        <Row style={{ marginBottom: 12 }}>
          <Button
            title={obd.live ? 'Pausar' : 'Ao vivo'}
            style={{ flex: 1 }}
            onPress={obd.live ? obd.stopLive : obd.startLive}
            disabled={!!busy}
          />
          <Button
            title="Ler tudo"
            variant="outline"
            style={{ flex: 1 }}
            loading={busy === 'read'}
            disabled={!!busy}
            onPress={() => run('read', async () => void (await obd.readOnce()))}
          />
        </Row>

        {shown.length === 0 && obd.values.battery == null ? (
          <Muted>Toque em "Ao vivo" ou "Ler tudo".</Muted>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {obd.values.battery != null && <Gauge name="Bateria (adaptador)" value={`${obd.values.battery.toFixed(1)} V`} />}
            {shown.map((p) => (
              <Gauge key={p.key} name={p.name} value={formatReading(p, obd.values[p.key])} />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Title>Códigos de falha (luz de injeção)</Title>
        <Row style={{ marginBottom: 8 }}>
          <Button title="Ler códigos" style={{ flex: 1 }} onPress={readDtcs} loading={busy === 'dtc'} disabled={!!busy} />
          <Button
            title="Apagar"
            variant="danger"
            style={{ flex: 1 }}
            onPress={clearDtcs}
            loading={busy === 'clear'}
            disabled={!!busy || !dtcs?.length && !pending.length}
          />
        </Row>
        {dtcs !== null && dtcs.length === 0 && pending.length === 0 && (
          <Text style={{ color: colors.success, fontWeight: '600' }}>Nenhum código de falha encontrado.</Text>
        )}
        {dtcs?.map((c) => <DtcRow key={c} code={c} />)}
        {pending.map((c) => (
          <DtcRow key={`p-${c}`} code={c} pending />
        ))}
      </Card>

      <Card>
        <Title>Veículo</Title>
        <Muted>Chassi (VIN): {vin ?? vehicle?.vin ?? 'não lido'}</Muted>
        <Row style={{ marginTop: 8 }}>
          <Button title="Ler chassi" variant="outline" style={{ flex: 1 }} onPress={readVin} loading={busy === 'vin'} disabled={!!busy} />
          <Button title="Salvar leitura" style={{ flex: 1 }} onPress={saveSnapshot} loading={busy === 'save'} disabled={!!busy} />
        </Row>
      </Card>
    </>
  );
}

function Gauge({ name, value }: { name: string; value: string }) {
  return (
    <View
      style={{
        width: '48%',
        backgroundColor: colors.bg,
        borderRadius: 8,
        padding: 10,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12 }}>{name}</Text>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

function DtcRow({ code, pending }: { code: string; pending?: boolean }) {
  return (
    <View style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Row>
        <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 16 }}>{code}</Text>
        {pending && <Badge text="Pendente" color={colors.warning} />}
      </Row>
      <Muted>{describeDtc(code)}</Muted>
    </View>
  );
}
