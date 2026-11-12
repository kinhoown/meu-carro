import { addMonthsIso, daysBetween, todayIso } from './format';
import type { Maintenance, PlanEntry, Vehicle } from './types';

export interface MaintenanceType {
  /** Chave estável usada no plano do veículo (não muda se o nome mudar). */
  id: string;
  name: string;
  /** Intervalo sugerido em km (0 = não se aplica). */
  km: number;
  /** Intervalo sugerido em meses (0 = não se aplica). */
  months: number;
}

// Intervalos típicos de referência. Sempre confira o manual do seu veículo.
export const MAINTENANCE_TYPES: MaintenanceType[] = [
  { id: 'oleo', name: 'Troca de óleo e filtro de óleo', km: 10000, months: 12 },
  { id: 'filtro_ar', name: 'Filtro de ar do motor', km: 15000, months: 12 },
  { id: 'filtro_cabine', name: 'Filtro de ar-condicionado (cabine)', km: 15000, months: 12 },
  { id: 'filtro_comb', name: 'Filtro de combustível', km: 20000, months: 24 },
  { id: 'velas', name: 'Velas de ignição', km: 30000, months: 36 },
  { id: 'correia_dentada', name: 'Correia dentada', km: 50000, months: 48 },
  { id: 'correia_acess', name: 'Correia do alternador / acessórios', km: 50000, months: 48 },
  { id: 'pastilhas', name: 'Pastilhas de freio', km: 30000, months: 0 },
  { id: 'discos', name: 'Discos de freio', km: 60000, months: 0 },
  { id: 'fluido_freio', name: 'Fluido de freio', km: 0, months: 24 },
  { id: 'arrefecimento', name: 'Líquido de arrefecimento', km: 40000, months: 24 },
  { id: 'alinhamento', name: 'Alinhamento e balanceamento', km: 10000, months: 12 },
  { id: 'rodizio', name: 'Rodízio de pneus', km: 10000, months: 0 },
  { id: 'pneus', name: 'Troca de pneus', km: 50000, months: 60 },
  { id: 'bateria', name: 'Bateria', km: 0, months: 36 },
  { id: 'amortecedores', name: 'Amortecedores', km: 60000, months: 0 },
  { id: 'oleo_cambio', name: 'Óleo do câmbio', km: 60000, months: 0 },
  { id: 'bicos', name: 'Limpeza de bicos injetores', km: 30000, months: 0 },
  { id: 'higienizacao_ac', name: 'Higienização do ar-condicionado', km: 0, months: 12 },
  { id: 'palhetas', name: 'Palhetas do limpador', km: 0, months: 12 },
  { id: 'embreagem', name: 'Kit de embreagem (verificar)', km: 80000, months: 0 },
  { id: 'revisao', name: 'Revisão geral', km: 10000, months: 12 },
];

/** Consertos comuns para manutenção corretiva (quando algo quebrou). */
export const CORRECTIVE_TYPES = [
  'Motor',
  'Câmbio / embreagem',
  'Suspensão',
  'Freios',
  'Direção',
  'Elétrica / bateria',
  'Injeção eletrônica',
  'Ar-condicionado',
  'Arrefecimento / radiador',
  'Escapamento',
  'Pneu furado / estourado',
  'Funilaria / batida',
  'Vidros / travas',
  'Iluminação / lâmpadas',
];

export const OTHER = 'Outro';

export function findType(name: string): MaintenanceType | undefined {
  return MAINTENANCE_TYPES.find((t) => t.name === name);
}

export function findTypeById(id: string): MaintenanceType | undefined {
  return MAINTENANCE_TYPES.find((t) => t.id === id);
}

/** "a cada 10.000 km ou 12 meses" */
export function intervalText(t: MaintenanceType): string {
  const parts: string[] = [];
  if (t.km) parts.push(`${t.km.toLocaleString('pt-BR')} km`);
  if (t.months) parts.push(t.months % 12 === 0 ? `${t.months / 12} ${t.months === 12 ? 'ano' : 'anos'}` : `${t.months} meses`);
  return parts.length ? `a cada ${parts.join(' ou ')}` : 'conforme o manual';
}

export type DueLevel = 'vencida' | 'proxima' | 'ok' | 'definir';

const KM_WARNING = 1000;
const DAYS_WARNING = 30;

export function levelFor(kmLeft: number | null, daysLeft: number | null): DueLevel {
  if (kmLeft == null && daysLeft == null) return 'definir';
  if ((kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft <= 0)) return 'vencida';
  if ((kmLeft != null && kmLeft <= KM_WARNING) || (daysLeft != null && daysLeft <= DAYS_WARNING)) return 'proxima';
  return 'ok';
}

export interface PlanItem {
  type: MaintenanceType;
  /** Último registro desse item no histórico. */
  last?: Maintenance;
  next_km: number | null;
  next_date: string | null;
  /** 'definido' = você informou; 'calculado' = última troca + intervalo; 'sem' = falta informar. */
  source: 'definido' | 'calculado' | 'sem';
  kmLeft: number | null;
  daysLeft: number | null;
  level: DueLevel;
  off: boolean;
}

/** Calcula a próxima troca a partir da última vez que foi feito. */
export function nextFromLast(t: MaintenanceType, last: { km: number; date: string }) {
  return {
    next_km: t.km ? last.km + t.km : null,
    next_date: t.months ? addMonthsIso(last.date, t.months) : null,
  };
}

/**
 * Monta o plano completo do veículo: todos os itens de manutenção preventiva, com a próxima
 * troca vinda (1) do que você definiu no plano, (2) da "próxima troca" do último registro, ou
 * (3) do último registro + intervalo sugerido. Ordena: vencidas, em breve, em dia, a definir.
 */
export function buildPlan(vehicle: Vehicle, history: Maintenance[], today = todayIso()): PlanItem[] {
  const latest = new Map<string, Maintenance>();
  for (const m of history) {
    if (m.kind === 'corretiva') continue;
    const prev = latest.get(m.type);
    if (!prev || m.date > prev.date || (m.date === prev.date && m.km > prev.km)) latest.set(m.type, m);
  }

  const order: Record<DueLevel, number> = { vencida: 0, proxima: 1, ok: 2, definir: 3 };

  return MAINTENANCE_TYPES.map((t): PlanItem => {
    const entry: PlanEntry = vehicle.plan?.[t.id] ?? {};
    const last = latest.get(t.name);
    let next_km: number | null = null;
    let next_date: string | null = null;
    let source: PlanItem['source'] = 'sem';

    if (entry.next_km != null || entry.next_date) {
      next_km = entry.next_km ?? null;
      next_date = entry.next_date ?? null;
      source = 'definido';
    } else if (last && (last.next_km != null || last.next_date)) {
      next_km = last.next_km;
      next_date = last.next_date;
      source = 'definido';
    } else if (last) {
      ({ next_km, next_date } = nextFromLast(t, last));
      source = 'calculado';
    }

    const kmLeft = next_km != null ? next_km - vehicle.current_km : null;
    const daysLeft = next_date ? daysBetween(today, next_date) : null;
    return { type: t, last, next_km, next_date, source, kmLeft, daysLeft, level: levelFor(kmLeft, daysLeft), off: !!entry.off };
  }).sort(
    (a, b) =>
      order[a.level] - order[b.level] ||
      (a.kmLeft ?? 1e9) - (b.kmLeft ?? 1e9) ||
      (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9),
  );
}
