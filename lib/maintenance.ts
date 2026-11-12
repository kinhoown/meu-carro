import { daysBetween, todayIso } from './format';
import type { Maintenance } from './types';

export interface MaintenanceType {
  name: string;
  /** Intervalo sugerido em km (0 = não se aplica). */
  km: number;
  /** Intervalo sugerido em meses (0 = não se aplica). */
  months: number;
}

// Intervalos típicos de referência. Sempre confira o manual do seu veículo.
export const MAINTENANCE_TYPES: MaintenanceType[] = [
  { name: 'Troca de óleo e filtro de óleo', km: 10000, months: 12 },
  { name: 'Filtro de ar do motor', km: 15000, months: 12 },
  { name: 'Filtro de ar-condicionado (cabine)', km: 15000, months: 12 },
  { name: 'Filtro de combustível', km: 20000, months: 24 },
  { name: 'Velas de ignição', km: 30000, months: 36 },
  { name: 'Correia dentada', km: 50000, months: 48 },
  { name: 'Correia do alternador / acessórios', km: 50000, months: 48 },
  { name: 'Pastilhas de freio', km: 30000, months: 0 },
  { name: 'Discos de freio', km: 60000, months: 0 },
  { name: 'Fluido de freio', km: 0, months: 24 },
  { name: 'Líquido de arrefecimento', km: 40000, months: 24 },
  { name: 'Alinhamento e balanceamento', km: 10000, months: 12 },
  { name: 'Rodízio de pneus', km: 10000, months: 0 },
  { name: 'Troca de pneus', km: 50000, months: 60 },
  { name: 'Bateria', km: 0, months: 36 },
  { name: 'Amortecedores', km: 60000, months: 0 },
  { name: 'Óleo do câmbio', km: 60000, months: 0 },
  { name: 'Limpeza de bicos injetores', km: 30000, months: 0 },
  { name: 'Revisão geral', km: 10000, months: 12 },
  { name: 'Outro', km: 0, months: 0 },
];

export function findType(name: string): MaintenanceType | undefined {
  return MAINTENANCE_TYPES.find((t) => t.name === name);
}

export type DueLevel = 'vencida' | 'proxima' | 'ok';

export interface Reminder {
  maintenance: Maintenance;
  level: DueLevel;
  kmLeft: number | null;
  daysLeft: number | null;
}

const KM_WARNING = 1000;
const DAYS_WARNING = 30;

export function dueStatus(m: Maintenance, currentKm: number, today = todayIso()): Reminder {
  const kmLeft = m.next_km != null ? m.next_km - currentKm : null;
  const daysLeft = m.next_date ? daysBetween(today, m.next_date) : null;

  let level: DueLevel = 'ok';
  if ((kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft <= 0)) level = 'vencida';
  else if ((kmLeft != null && kmLeft <= KM_WARNING) || (daysLeft != null && daysLeft <= DAYS_WARNING))
    level = 'proxima';

  return { maintenance: m, level, kmLeft, daysLeft };
}

/**
 * Para cada tipo de manutenção, pega só o registro mais recente que tenha próxima troca
 * definida e calcula o status. Ordena: vencidas, próximas, em dia.
 */
export function buildReminders(list: Maintenance[], currentKm: number): Reminder[] {
  const latest = new Map<string, Maintenance>();
  for (const m of list) {
    if (m.next_km == null && !m.next_date) continue;
    const prev = latest.get(m.type);
    if (!prev || m.date > prev.date || (m.date === prev.date && m.km > prev.km)) latest.set(m.type, m);
  }
  const order: Record<DueLevel, number> = { vencida: 0, proxima: 1, ok: 2 };
  return [...latest.values()]
    .map((m) => dueStatus(m, currentKm))
    .sort((a, b) => order[a.level] - order[b.level] || (a.kmLeft ?? 1e9) - (b.kmLeft ?? 1e9));
}
