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
  created_at: string;
}

export type NewVehicle = Omit<Vehicle, 'id' | 'user_id' | 'created_at'>;

export interface Maintenance {
  id: string;
  user_id: string;
  vehicle_id: string;
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
