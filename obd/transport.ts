/**
 * Canal bruto de comunicação com o adaptador ELM327.
 * Cada implementação (Bluetooth clássico, BLE, Wi-Fi) só sabe enviar texto e entregar o que chega.
 */
export interface ObdTransport {
  readonly label: string;
  connect(): Promise<void>;
  /** Envia um comando; a implementação acrescenta o "\r" final. */
  write(command: string): Promise<void>;
  /** Registra o callback para os dados recebidos (texto ASCII, pode vir em pedaços). */
  onData(cb: (chunk: string) => void): void;
  /** Chamado quando a conexão cai sem que o app tenha pedido. */
  onClose(cb: (reason?: string) => void): void;
  disconnect(): Promise<void>;
}

export type TransportKind = 'classic' | 'ble' | 'wifi';
