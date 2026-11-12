import type { BodyType } from './vehicleLook';

export interface Vehicle {
  id: string;
  user_id: string;
  plate: string;
  nickname: string | null;
  brand: string;
  model: string;
  year_model: number | null;
  fuel: string | null;
  fipe_code: string | null;
  fipe_value: string | null;
  fipe_ref: string | null;
  vin: string | null;
  current_km: number;
  /** Desenho do carro (adivinhado pelo modelo; o usuário pode trocar). */
  body?: BodyType | null;
  color?: string | null;
  /** Plano de manutenção: próxima troca de cada item, pela chave do tipo (lib/maintenance.ts). */
  plan?: Record<string, PlanEntry>;
  created_at: string;
}

export interface PlanEntry {
  next_km?: number | null;
  /** ISO yyyy-mm-dd */
  next_date?: string | null;
  /** true = "não se aplica ao meu carro" (fica oculto no plano). */
  off?: boolean;
}

export type NewVehicle = Omit<Vehicle, 'id' | 'user_id' | 'created_at'>;

export type MaintenanceKind = 'preventiva' | 'corretiva';

export interface Maintenance {
  id: string;
  user_id: string;
  vehicle_id: string;
  /** Registros antigos não têm: contam como preventiva. */
  kind?: MaintenanceKind;
  type: string;
  description: string | null;
  /** ISO yyyy-mm-dd */
  date: string;
  km: number;
  cost: number | null;
  workshop: string | null;
  notes: string | null;
  next_km: number | null;
  /** ISO yyyy-mm-dd */
  next_date: string | null;
  created_at: string;
}

export type MaintenanceInput = Omit<Maintenance, 'id' | 'user_id' | 'created_at'>;

export interface ObdSnapshot {
  id: string;
  vehicle_id: string;
  created_at: string;
  protocol: string | null;
  vin: string | null;
  dtcs: string[];
  readings: Record<string, number>;
}

export type ModStatus = 'planejado' | 'feito';

/** Item de estética / modificação (bancos, faróis, rodas, som...). */
export interface Mod {
  id: string;
  user_id: string;
  vehicle_id: string;
  category: string;
  title: string;
  status: ModStatus;
  /** ISO yyyy-mm-dd */
  date: string | null;
  km: number | null;
  cost: number | null;
  brand: string | null;
  notes: string | null;
  created_at: string;
}

export type ModInput = Omit<Mod, 'id' | 'user_id' | 'created_at'>;
