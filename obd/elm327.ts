import { decodeDtc } from './dtc';
import type { PidDef } from './pids';
import type { ObdTransport } from './transport';

const NO_DATA = /NO DATA|UNABLE TO CONNECT|CAN ERROR|BUS ERROR|BUS INIT|STOPPED|\?|ERROR/;

interface Pending {
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Fala o protocolo do chip ELM327 (e clones) sobre qualquer transporte.
 * Os comandos são enfileirados: o ELM327 só aceita um por vez e responde terminando com '>'.
 */
export class Elm327 {
  private buffer = '';
  private pending: Pending | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  /** Protocolo detectado (ATDPN). 6–9 e A–C são CAN. */
  protocol = '';
  protocolName = '';

  constructor(private readonly transport: ObdTransport) {
    transport.onData((chunk) => this.handle(chunk));
  }

  private handle(chunk: string) {
    this.buffer += chunk;
    const idx = this.buffer.indexOf('>');
    if (idx === -1) return;
    const raw = this.buffer.slice(0, idx);
    this.buffer = this.buffer.slice(idx + 1);
    const p = this.pending;
    if (p) {
      clearTimeout(p.timer);
      this.pending = null;
      p.resolve(raw);
    }
  }

  /** Envia um comando e devolve as linhas da resposta, já limpas. */
  send(command: string, timeoutMs = 4000): Promise<string[]> {
    const run = () =>
      new Promise<string[]>((resolve, reject) => {
        this.buffer = '';
        const timer = setTimeout(() => {
          this.pending = null;
          reject(new Error(`Sem resposta para ${command}`));
        }, timeoutMs);
        this.pending = { resolve: (raw) => resolve(cleanLines(raw, command)), reject, timer };
        this.transport.write(command).catch((e: Error) => {
          clearTimeout(timer);
          this.pending = null;
          reject(e);
        });
      });
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async init() {
    // ATZ reinicia o chip; alguns clones demoram ou não respondem direito, então tentamos e seguimos.
    await this.send('ATZ', 5000).catch(() => undefined);
    for (const cmd of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', 'ATSP0']) {
      await this.send(cmd, 3000).catch(() => undefined);
    }
    // Primeiro pedido força a busca automática de protocolo (pode levar vários segundos).
    const lines = await this.send('0100', 15000);
    if (lines.some((l) => NO_DATA.test(l))) {
      throw new Error('O adaptador não conseguiu falar com o carro. A ignição está ligada?');
    }
    this.protocol = (await this.send('ATDPN').catch(() => ['']))[0]?.replace(/^A/, '') ?? '';
    this.protocolName = (await this.send('ATDP').catch(() => ['']))[0] ?? '';
  }

  private get isCan() {
    return /^[6-9A-C]$/i.test(this.protocol);
  }

  /** Lê um PID do modo 01. Retorna null se o carro não suportar ou não responder. */
  async readPid(def: PidDef): Promise<number | null> {
    const lines = await this.send(`01${def.pid}`).catch(() => null);
    if (!lines) return null;
    const prefix = `41${def.pid}`;
    for (const line of lines) {
      const at = line.indexOf(prefix);
      if (at === -1) continue;
      const bytes = hexToBytes(line.slice(at + prefix.length)).slice(0, def.bytes);
      if (bytes.length < def.bytes) continue;
      return def.decode(bytes);
    }
    return null;
  }

  /** Consulta os bitmaps 0100/0120/0140... para saber quais PIDs o carro suporta. */
  async supportedPids(): Promise<Set<string>> {
    const supported = new Set<string>();
    for (let base = 0x00; base <= 0xc0; base += 0x20) {
      const pid = base.toString(16).toUpperCase().padStart(2, '0');
      const lines = await this.send(`01${pid}`).catch(() => null);
      const line = lines?.find((l) => l.includes(`41${pid}`));
      if (!line) break;
      const bytes = hexToBytes(line.slice(line.indexOf(`41${pid}`) + 4)).slice(0, 4);
      if (bytes.length < 4) break;
      for (let i = 0; i < 32; i++) {
        if (bytes[i >> 3] & (0x80 >> (i & 7))) {
          supported.add((base + i + 1).toString(16).toUpperCase().padStart(2, '0'));
        }
      }
      // O último bit indica se existe o próximo bloco.
      if (!supported.has((base + 0x20).toString(16).toUpperCase().padStart(2, '0'))) break;
    }
    return supported;
  }

  /** Modo 03: códigos de falha armazenados (luz de injeção). */
  async readDtcs(): Promise<string[]> {
    const lines = await this.send('03', 8000);
    return this.parseDtcResponse(lines, '43');
  }

  /** Modo 07: códigos pendentes (ainda não acenderam a luz). */
  async readPendingDtcs(): Promise<string[]> {
    const lines = await this.send('07', 8000).catch(() => []);
    return this.parseDtcResponse(lines, '47');
  }

  /** Modo 04: apaga códigos de falha e a luz de injeção. */
  async clearDtcs(): Promise<void> {
    const lines = await this.send('04', 8000);
    if (!lines.some((l) => l.includes('44'))) throw new Error('O carro não confirmou a limpeza dos códigos.');
  }

  /** Modo 09 PID 02: número do chassi (VIN). Muitos carros anteriores a 2005 não informam. */
  async readVin(): Promise<string | null> {
    const lines = await this.send('0902', 8000).catch(() => null);
    if (!lines) return null;
    const hex = joinFrames(lines);
    const at = hex.indexOf('4902');
    if (at === -1) return null;
    const ascii = hexToBytes(hex.slice(at + 4))
      .map((b) => String.fromCharCode(b))
      .join('')
      .replace(/[^A-HJ-NPR-Z0-9]/g, '');
    return ascii.length >= 17 ? ascii.slice(-17) : null;
  }

  async readBatteryVoltage(): Promise<number | null> {
    const lines = await this.send('ATRV').catch(() => null);
    const m = lines?.[0]?.match(/([\d.]+)\s*V/i);
    return m ? Number(m[1]) : null;
  }

  private parseDtcResponse(lines: string[], mode: string): string[] {
    if (lines.some((l) => /NO DATA/.test(l))) return [];
    const codes = new Set<string>();

    if (this.isCan) {
      // CAN: [43][qtd][A B][A B]... possivelmente em vários frames ("0:", "1:"...) e de várias ECUs.
      const frames = lines.some((l) => /^[0-9A-F]:/.test(l)) ? [joinFrames(lines)] : lines;
      for (const f of frames) {
        const at = f.indexOf(mode);
        if (at === -1) continue;
        const bytes = hexToBytes(f.slice(at + 2));
        const count = bytes[0] ?? 0;
        for (let i = 0; i < count; i++) {
          const a = bytes[1 + i * 2];
          const b = bytes[2 + i * 2];
          if (a === undefined || b === undefined) break;
          if (a || b) codes.add(decodeDtc(a, b));
        }
      }
    } else {
      // Protocolos antigos: cada linha "43 A B A B A B" (3 códigos por linha, 0000 = vazio).
      for (const line of lines) {
        const at = line.indexOf(mode);
        if (at === -1) continue;
        const bytes = hexToBytes(line.slice(at + 2));
        for (let i = 0; i + 1 < bytes.length; i += 2) {
          if (bytes[i] || bytes[i + 1]) codes.add(decodeDtc(bytes[i], bytes[i + 1]));
        }
      }
    }
    return [...codes];
  }
}

/** Remove eco, "SEARCHING...", espaços e linhas vazias. */
function cleanLines(raw: string, command: string): string[] {
  return raw
    .replace(/\0/g, '')
    .split(/[\r\n]+/)
    .map((l) => l.trim().toUpperCase())
    .filter((l) => l && l !== command.toUpperCase() && !l.startsWith('SEARCHING'))
    .map((l) => (l.startsWith('AT') || /[G-Z]{2}/.test(l) ? l : l.replace(/\s+/g, '')));
}

/** Junta respostas multi-frame do CAN: "014" / "0:490201..." / "1:..." -> hex contínuo. */
function joinFrames(lines: string[]): string {
  return lines
    .filter((l) => !/^[0-9A-F]{3}$/.test(l))
    .map((l) => l.replace(/^[0-9A-F]:/, ''))
    .join('');
}

function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/[^0-9A-F]/gi, '');
  const out: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}
