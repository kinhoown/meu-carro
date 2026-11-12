/** Placa antiga (ABC1234) ou Mercosul (ABC1D23). */
const PLATE_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

export function isValidPlate(plate: string): boolean {
  return PLATE_RE.test(normalizePlate(plate));
}

/** ABC1234 -> ABC-1234 ; ABC1D23 continua ABC1D23 (padrão Mercosul não tem hífen). */
export function formatPlate(plate: string): string {
  const p = normalizePlate(plate);
  return /^[A-Z]{3}[0-9]{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function formatKm(km: number | null | undefined): string {
  if (km == null) return '-';
  return `${Math.round(km).toLocaleString('pt-BR')} km`;
}

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseNumber(text: string): number | null {
  const clean = text.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** yyyy-mm-dd -> dd/mm/aaaa */
export function isoToBr(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** dd/mm/aaaa -> yyyy-mm-dd (ou null se inválida) */
export function brToIso(br: string): string | null {
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return toIso(date);
}

/** Máscara simples enquanto digita: 12032025 -> 12/03/2025 */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toIso(new Date(y, m - 1 + months, d));
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
  const a = new Date(fromIso + 'T00:00:00');
  const b = new Date(toIsoDate + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
