/** PIDs do modo 01 (dados em tempo real) que o app lê. Fórmulas do padrão SAE J1979. */
export interface PidDef {
  /** PID em hexadecimal, 2 dígitos (ex.: "0C"). */
  pid: string;
  key: string;
  name: string;
  unit: string;
  /** Quantos bytes de dados a resposta tem. */
  bytes: number;
  decode: (b: number[]) => number;
  decimals?: number;
}

const pct = (a: number) => (a * 100) / 255;

export const PIDS: PidDef[] = [
  { pid: '0C', key: 'rpm', name: 'Rotação', unit: 'rpm', bytes: 2, decode: ([a, b]) => (a * 256 + b) / 4 },
  { pid: '0D', key: 'speed', name: 'Velocidade', unit: 'km/h', bytes: 1, decode: ([a]) => a },
  { pid: '05', key: 'coolant', name: 'Temp. do motor', unit: '°C', bytes: 1, decode: ([a]) => a - 40 },
  { pid: '0F', key: 'intake', name: 'Temp. do ar de admissão', unit: '°C', bytes: 1, decode: ([a]) => a - 40 },
  { pid: '04', key: 'load', name: 'Carga do motor', unit: '%', bytes: 1, decode: ([a]) => pct(a) },
  { pid: '11', key: 'throttle', name: 'Acelerador', unit: '%', bytes: 1, decode: ([a]) => pct(a) },
  { pid: '2F', key: 'fuel', name: 'Nível de combustível', unit: '%', bytes: 1, decode: ([a]) => pct(a) },
  { pid: '42', key: 'voltage', name: 'Tensão da ECU', unit: 'V', bytes: 2, decode: ([a, b]) => (a * 256 + b) / 1000, decimals: 1 },
  { pid: '5C', key: 'oil', name: 'Temp. do óleo', unit: '°C', bytes: 1, decode: ([a]) => a - 40 },
  { pid: '1F', key: 'runtime', name: 'Tempo desde a partida', unit: 's', bytes: 2, decode: ([a, b]) => a * 256 + b },
  { pid: '21', key: 'distMil', name: 'Distância com luz de injeção', unit: 'km', bytes: 2, decode: ([a, b]) => a * 256 + b },
  { pid: '31', key: 'distClear', name: 'Distância desde que apagou códigos', unit: 'km', bytes: 2, decode: ([a, b]) => a * 256 + b },
  {
    pid: 'A6',
    key: 'odometer',
    name: 'Hodômetro',
    unit: 'km',
    bytes: 4,
    decode: ([a, b, c, d]) => (a * 2 ** 24 + b * 2 ** 16 + c * 2 ** 8 + d) / 10,
  },
];

export function formatReading(def: PidDef, value: number): string {
  return `${value.toFixed(def.decimals ?? 0)} ${def.unit}`;
}
