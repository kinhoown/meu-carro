import RNBluetoothClassic, { type BluetoothDevice } from 'react-native-bluetooth-classic';
import type { ObdTransport } from './transport';

export interface ClassicDevice {
  address: string;
  name: string;
}

/**
 * Lista os dispositivos já pareados no Android.
 * Adaptadores ELM327 clássicos precisam ser pareados antes nas configurações de Bluetooth
 * (PIN normalmente 1234 ou 0000).
 */
export async function listBondedDevices(): Promise<ClassicDevice[]> {
  const enabled = await RNBluetoothClassic.isBluetoothEnabled();
  if (!enabled) {
    const ok = await RNBluetoothClassic.requestBluetoothEnabled();
    if (!ok) throw new Error('Ative o Bluetooth para continuar.');
  }
  const devices = await RNBluetoothClassic.getBondedDevices();
  return devices.map((d) => ({ address: d.address, name: d.name || d.address }));
}

/** Bluetooth clássico (SPP / perfil serial) — o tipo mais comum de ELM327 barato. */
export class ClassicTransport implements ObdTransport {
  readonly label: string;
  private device?: BluetoothDevice;
  private dataCb: (chunk: string) => void = () => {};
  private closeCb: (reason?: string) => void = () => {};
  private subs: { remove(): void }[] = [];

  constructor(private readonly target: ClassicDevice) {
    this.label = `Bluetooth: ${target.name}`;
  }

  async connect() {
    // Com delimitador '>' a biblioteca entrega uma mensagem por resposta do ELM327
    // (sem o próprio '>'); devolvemos o '>' para o parser tratar todos os transportes igual.
    this.device = await RNBluetoothClassic.connectToDevice(this.target.address, {
      delimiter: '>',
      charset: 'ascii',
    } as Record<string, unknown>);
    this.subs.push(this.device.onDataReceived((e) => this.dataCb(`${e.data}>`)));
    this.subs.push(
      RNBluetoothClassic.onDeviceDisconnected((e) => {
        if (e.device?.address === this.target.address) this.closeCb('Adaptador desconectado');
      }),
    );
  }

  async write(command: string) {
    if (!this.device) throw new Error('Não conectado');
    await this.device.write(`${command}\r`, 'ascii');
  }

  onData(cb: (chunk: string) => void) {
    this.dataCb = cb;
  }

  onClose(cb: (reason?: string) => void) {
    this.closeCb = cb;
  }

  async disconnect() {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    try {
      await this.device?.disconnect();
    } catch {
      // já desconectado
    }
    this.device = undefined;
  }
}
