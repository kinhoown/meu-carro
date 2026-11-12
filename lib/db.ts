import { supabase } from './supabase';
import type { Maintenance, MaintenanceInput, NewVehicle, ObdSnapshot, Vehicle } from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------- Veículos ----------

export async function listVehicles(): Promise<Vehicle[]> {
  return check(await supabase.from('vehicles').select('*').order('created_at'));
}

export async function getVehicle(id: string): Promise<Vehicle> {
  return check(await supabase.from('vehicles').select('*').eq('id', id).single());
}

export async function createVehicle(v: NewVehicle): Promise<Vehicle> {
  const res = await supabase.from('vehicles').insert(v).select().single();
  if (res.error?.code === '23505') throw new Error('Você já cadastrou um veículo com essa placa.');
  return check(res);
}

export async function updateVehicle(id: string, patch: Partial<NewVehicle>): Promise<void> {
  check(await supabase.from('vehicles').update(patch).eq('id', id));
}

export async function deleteVehicle(id: string): Promise<void> {
  check(await supabase.from('vehicles').delete().eq('id', id));
}

// ---------- Manutenções ----------

export async function listMaintenances(vehicleId: string): Promise<Maintenance[]> {
  return check(
    await supabase
      .from('maintenances')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('date', { ascending: false })
      .order('km', { ascending: false }),
  );
}

export async function getMaintenance(id: string): Promise<Maintenance> {
  return check(await supabase.from('maintenances').select('*').eq('id', id).single());
}

export async function saveMaintenance(input: MaintenanceInput, id?: string): Promise<void> {
  if (id) check(await supabase.from('maintenances').update(input).eq('id', id));
  else check(await supabase.from('maintenances').insert(input));
}

export async function deleteMaintenance(id: string): Promise<void> {
  check(await supabase.from('maintenances').delete().eq('id', id));
}

// ---------- Leituras OBD ----------

export async function saveObdSnapshot(s: Omit<ObdSnapshot, 'id' | 'created_at'>): Promise<void> {
  check(await supabase.from('obd_snapshots').insert(s));
}

export async function listObdSnapshots(vehicleId: string, limit = 5): Promise<ObdSnapshot[]> {
  return check(
    await supabase
      .from('obd_snapshots')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
}
