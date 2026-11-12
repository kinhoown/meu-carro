/** Aparência do desenho do carro: tipo de carroceria e cor. */

export type BodyType = 'hatch' | 'sedan' | 'suv' | 'pickup' | 'van';

export const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'hatch', label: 'Hatch' },
  { value: 'sedan', label: 'Sedã' },
  { value: 'suv', label: 'SUV' },
  { value: 'pickup', label: 'Picape' },
  { value: 'van', label: 'Van / minivan' },
];

export const CAR_COLORS: { value: string; label: string; hex: string }[] = [
  { value: 'branco', label: 'Branco', hex: '#f4f5f7' },
  { value: 'prata', label: 'Prata', hex: '#b8bec8' },
  { value: 'cinza', label: 'Cinza', hex: '#6b7280' },
  { value: 'preto', label: 'Preto', hex: '#23262d' },
  { value: 'vermelho', label: 'Vermelho', hex: '#d32f2f' },
  { value: 'vinho', label: 'Vinho', hex: '#7b1e2b' },
  { value: 'azul', label: 'Azul', hex: '#1f5fbf' },
  { value: 'azul-claro', label: 'Azul-claro', hex: '#4fa3e0' },
  { value: 'verde', label: 'Verde', hex: '#2e7d4f' },
  { value: 'amarelo', label: 'Amarelo', hex: '#f2c230' },
  { value: 'laranja', label: 'Laranja', hex: '#ef7d22' },
  { value: 'marrom', label: 'Marrom / bege', hex: '#8d6e52' },
];

export const DEFAULT_COLOR = 'prata';

export function colorHex(value: string | null | undefined): string {
  return CAR_COLORS.find((c) => c.value === value)?.hex ?? CAR_COLORS[1].hex;
}

const PICKUPS = [
  'strada', 'saveiro', 'toro', 'hilux', 's10', 's-10', 'ranger', 'amarok', 'frontier', 'l200', 'l-200',
  'montana', 'oroch', 'maverick', 'rampage', 'ram ', 'ram 1500', 'ram 2500', 'f-250', 'f250', 'f-150',
  'courier', 'titano', 'dakota', 'silverado', 'tundra', 'tacoma', 'gladiator', 'shark', 'cabine',
];
const VANS = [
  'spin', 'doblo', 'doblò', 'kombi', 'master', 'sprinter', 'ducato', 'partner', 'berlingo', 'kangoo',
  'jumper', 'boxer', 'daily', 'transit', 'trafic', 'expert', 'scudo', 'fiorino', 'besta', 'h100', 'hr ',
  'zafira', 'meriva', 'idea', 'livina', 'grand c4 picasso', 'picasso', 'sharan', 'odyssey', 'carnival',
];
const SUVS = [
  'compass', 'renegade', 'commander', 'creta', 'hr-v', 'hrv', 'wr-v', 'wrv', 'cr-v', 'crv', 't-cross',
  'tcross', 'tracker', 'kicks', 'duster', 'ecosport', 'nivus', 'pulse', 'fastback', 'tiguan', 'taos',
  'touareg', 'corolla cross', 'rav4', 'rav 4', 'sw4', 'hilux sw4', 'tucson', 'ix35', 'santa fe', 'sportage',
  'sorento', 'captur', 'kardian', 'koleos', 'territory', 'equinox', 'trailblazer', 'blazer', 'pajero',
  'outlander', 'asx', 'eclipse cross', 'aircross', '2008', '3008', '5008', 'c4 cactus', 'cactus', 'c3 aircross',
  'haval', 'h6', 'jolion', 'song', 'yuan', 'tang', 'tiggo', 'bronco', 'edge', 'x1', 'x3', 'x5', 'q3', 'q5',
  'q7', 'gla', 'glc', 'gle', 'evoque', 'discovery', 'range rover', 'xc40', 'xc60', 'xc90', 'wrangler',
  'cherokee', 'vitara', 'jimny', 'forester', ' xv ', 'stonic', 'soul', ' tera ',
  'bayon', 'kona', 'seltos', 'outback', 'freemont', 'journey', 'murano', 'pathfinder', 'xtrail', 'x-trail',
];
const SEDANS = [
  'sedan', 'sedã', 'corolla', 'civic', 'cruze', 'virtus', 'voyage', 'prisma', 'onix plus', 'hb20s', 'hb20 s',
  'cronos', 'versa', 'sentra', 'city', 'logan', 'jetta', 'grand siena', 'siena', 'cobalt', 'fluence', 'vectra',
  'linea', 'accord', 'camry', 'elantra', 'azera', 'sonata', 'passat', 'classe c', 'classe e', 'c 180', 'c 200',
  'c 300', 'série 3', 'serie 3', '320i', '328i', '330e', 'a4', 'a6', '408', 'c4 lounge', 'bora', 'polo sedan',
  'fiesta sedan', 'focus sedan', 'astra sedan', 'yaris sedan', 'cerato', 'optima', 'fusion', 'altima', 'lancer',
  'symbol', 'clio sedan', 'premio', 'santana', 'marea', 'tempra', 'monza', 'omega', 'chevette sedan', 'arrizo',
  'king', 'k5', 'mondeo', 'stinger', 'galant',
];

/** Adivinha a carroceria pelo nome da FIPE (ex.: "COMPASS LONGITUDE 2.0" -> SUV). */
export function guessBody(model: string): BodyType {
  const m = ` ${model.toLowerCase()} `;
  const has = (list: string[]) => list.some((k) => m.includes(k));
  if (m.includes('sw4')) return 'suv'; // "Hilux SW4" é SUV, não picape
  if (/\b(cd|cs|ce|cab\.? ?dupla|cab\.? ?simples|cabine)\b/.test(m) || has(PICKUPS)) return 'pickup';
  if (has(SUVS)) return 'suv';
  if (has(VANS)) return 'van';
  if (has(SEDANS)) return 'sedan';
  return 'hatch';
}

/** Escurece/clareia um #rrggbb (amount -1..1). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
