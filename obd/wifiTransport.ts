import TcpSocket from 'react-native-tcp-socket';
import type { ObdTransport } from './transport';

export const DEFAULT_WIFI_HOST = '192.168.0.10';
export const DEFAULT_WIFI_PORT = 35000;

type Socket = ReturnType<typeof TcpSocket.createConnection>;

/**
 * ELM327 Wi-Fi: o adaptador cria uma rede própria (ex.: "WiFi_OBDII").
 * Conecte o celular nessa rede antes. Endereço padrão 192.168.0.10:35000.
 */
export class WifiTransport implements ObdTransport {
  readonly label: string;
  private socket?: Socket;
  private dataCb: (chunk: string) => void = () => {};
  private closeCb: (reason?: string) => void = () => {};
  private closing = false;

  constructor(
    private readonly host = DEFAULT_WIFI_HOST,
    private readonly port = DEFAULT_WIFI_PORT,
  ) {
    this.label = `Wi-Fi: ${host}:${port}`;
  }

  connect(): Promise<void> {
    this.closing = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(new Error('Tempo esgotado. O celular está conectado na rede Wi-Fi do adaptador?'));
      }, 8000);

      // interface: 'wifi' força o Android a usar o Wi-Fi mesmo sem internet nessa rede
      // (senão ele pode mandar o tráfego pelos dados móveis).
      const socket = TcpSocket.createConnection(
        { host: this.host, port: this.port, interface: 'wifi' },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        },
      );

      socket.on('data', (data) => {
        this.dataCb(typeof data === 'string' ? data : data.toString('latin1'));
      });
      socket.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`Falha ao conectar no adaptador Wi-Fi: ${err.message}`));
        }
      });
      socket.on('close', () => {
        if (settled && !this.closing) this.closeCb('Conexão Wi-Fi encerrada');
      });

      this.socket = socket;
    });
  }

  async write(command: string) {
    if (!this.socket) throw new Error('Não conectado');
    this.socket.write(`${command}\r`);
  }

  onData(cb: (chunk: string) => void) {
    this.dataCb = cb;
  }

  onClose(cb: (reason?: string) => void) {
    this.closeCb = cb;
  }

  async disconnect() {
    this.closing = true;
    this.socket?.destroy();
    this.socket = undefined;
  }
}
