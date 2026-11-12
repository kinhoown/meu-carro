import { Buffer } from 'buffer';
import {
  BleManager,
  State,
  type Characteristic,
  type Device,
  type Subscription,
} from 'react-native-ble-plx';
import type { ObdTransport } from './transport';

export const bleManager = new BleManager();

export interface BleDeviceInfo {
  id: string;
  name: string;
  rssi: number | null;
}

/** Serviços padrão do Bluetooth que não são o canal serial do adaptador. */
const IGNORED_SERVICES = ['00001800', '00001801', '0000180a', '0000180f'];

/** UUIDs mais usados por adaptadores ELM327 BLE (Vgate, Veepeak, clones). Preferidos quando existem. */
const PREFERRED = ['fff1', 'fff2', 'ffe1', '2af0', '2af1'];

const shortId = (uuid: string) => uuid.toLowerCase().slice(4, 8);

/**
 * Procura dispositivos BLE próximos. Retorna função para parar a busca.
 * Mostra todos os que têm nome; adaptadores OBD costumam se chamar "OBDII", "Vgate", "IOS-Vlink", "V-LINK" etc.
 */
export async function scanBle(onDevice: (d: BleDeviceInfo) => void, timeoutMs = 12000): Promise<() => void> {
  const state = await bleManager.state();
  if (state !== State.PoweredOn) throw new Error('Ative o Bluetooth para procurar o adaptador.');

  const stop = () => bleManager.stopDeviceScan();
  const timer = setTimeout(stop, timeoutMs);

  bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) {
      clearTimeout(timer);
      stop();
      return;
    }
    if (device && (device.name || device.localName)) {
      onDevice({ id: device.id, name: (device.name || device.localName)!, rssi: device.rssi });
    }
  });

  return () => {
    clearTimeout(timer);
    stop();
  };
}

/** Bluetooth Low Energy — necessário para adaptadores "BLE" / "4.0". */
export class BleTransport implements ObdTransport {
  readonly label: string;
  private device?: Device;
  private serviceUUID = '';
  private notifyUUID = '';
  private writeUUID = '';
  private writeWithResponse = false;
  private dataCb: (chunk: string) => void = () => {};
  private closeCb: (reason?: string) => void = () => {};
  private subs: Subscription[] = [];
  private closing = false;

  constructor(private readonly target: BleDeviceInfo) {
    this.label = `BLE: ${target.name}`;
  }

  async connect() {
    bleManager.stopDeviceScan();
    this.closing = false;
    const device = await bleManager.connectToDevice(this.target.id, { timeout: 10000, requestMTU: 185 });
    await device.discoverAllServicesAndCharacteristics();
    this.device = device;

    await this.pickCharacteristics(device);

    this.subs.push(
      device.monitorCharacteristicForService(this.serviceUUID, this.notifyUUID, (error, c) => {
        if (error) return;
        if (c?.value) this.dataCb(Buffer.from(c.value, 'base64').toString('latin1'));
      }),
    );
    this.subs.push(
      device.onDisconnected(() => {
        if (!this.closing) this.closeCb('Adaptador desconectado');
      }),
    );
  }

  /** Descobre qual característica recebe notificações e qual aceita escrita (variam por fabricante). */
  private async pickCharacteristics(device: Device) {
    const services = await device.services();
    const candidates: { service: string; notify?: Characteristic; write?: Characteristic }[] = [];

    for (const s of services) {
      if (IGNORED_SERVICES.some((p) => s.uuid.toLowerCase().startsWith(p))) continue;
      const chars = await s.characteristics();
      const byPreference = (a: Characteristic, b: Characteristic) =>
        rank(a.uuid) - rank(b.uuid);
      const notify = chars.filter((c) => c.isNotifiable || c.isIndicatable).sort(byPreference)[0];
      const write = chars
        .filter((c) => c.isWritableWithoutResponse || c.isWritableWithResponse)
        .sort(byPreference)[0];
      if (notify && write) candidates.push({ service: s.uuid, notify, write });
    }

    const chosen =
      candidates.find((c) => PREFERRED.includes(shortId(c.notify!.uuid))) ?? candidates[0];
    if (!chosen) {
      throw new Error('Este dispositivo BLE não parece ser um adaptador OBD (sem canal serial).');
    }
    this.serviceUUID = chosen.service;
    this.notifyUUID = chosen.notify!.uuid;
    this.writeUUID = chosen.write!.uuid;
    this.writeWithResponse = !chosen.write!.isWritableWithoutResponse;
  }

  async write(command: string) {
    if (!this.device) throw new Error('Não conectado');
    const payload = Buffer.from(`${command}\r`, 'latin1').toString('base64');
    if (this.writeWithResponse) {
      await this.device.writeCharacteristicWithResponseForService(this.serviceUUID, this.writeUUID, payload);
    } else {
      await this.device.writeCharacteristicWithoutResponseForService(this.serviceUUID, this.writeUUID, payload);
    }
  }

  onData(cb: (chunk: string) => void) {
    this.dataCb = cb;
  }

  onClose(cb: (reason?: string) => void) {
    this.closeCb = cb;
  }

  async disconnect() {
    this.closing = true;
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    try {
      await bleManager.cancelDeviceConnection(this.target.id);
    } catch {
      // já desconectado
    }
    this.device = undefined;
  }
}

function rank(uuid: string) {
  const i = PREFERRED.indexOf(shortId(uuid));
  return i === -1 ? 99 : i;
}
