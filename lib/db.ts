import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { currentUid } from './auth';
import { db } from './firebase';
import type { Maintenance, MaintenanceInput, NewVehicle, ObdSnapshot, Vehicle } from './types';

/**
 * Firestore, um "cantinho" por usuário (ver firestore.rules):
 *   users/{uid}/vehicles/{id}
 *   users/{uid}/maintenances/{id}     (campo vehicle_id)
 *   users/{uid}/obd_snapshots/{id}    (campo vehicle_id)
 * Consultas usam só igualdade em um campo e ordenam no celular, para não precisar
 * criar índices compostos no console do Firebase.
 */
const col = (name: 'vehicles' | 'maintenances' | 'obd_snapshots') =>
  collection(db, 'users', currentUid(), name);

const now = () => new Date().toISOString();

function fromDoc<T>(snap: DocumentSnapshot): T {
  if (!snap.exists()) throw new Error('Registro não encontrado.');
  return { ...(snap.data() as object), id: snap.id } as T;
}

// ---------- Veículos ----------

export async function listVehicles(): Promise<Vehicle[]> {
  const snap = await getDocs(col('vehicles'));
  return snap.docs
    .map((d) => fromDoc<Vehicle>(d))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getVehicle(id: string): Promise<Vehicle> {
  return fromDoc<Vehicle>(await getDoc(doc(col('vehicles'), id)));
}

export async function createVehicle(v: NewVehicle): Promise<Vehicle> {
  const dup = await getDocs(query(col('vehicles'), where('plate', '==', v.plate)));
  if (!dup.empty) throw new Error('Você já cadastrou um veículo com essa placa.');
  const data = { ...v, user_id: currentUid(), created_at: now() };
  const ref = await addDoc(col('vehicles'), data);
  return { ...data, id: ref.id };
}

export async function updateVehicle(id: string, patch: Partial<NewVehicle>): Promise<void> {
  await updateDoc(doc(col('vehicles'), id), patch);
}

/** Apaga o veículo junto com as manutenções e leituras dele. */
export async function deleteVehicle(id: string): Promise<void> {
  const [maint, snaps] = await Promise.all([
    getDocs(query(col('maintenances'), where('vehicle_id', '==', id))),
    getDocs(query(col('obd_snapshots'), where('vehicle_id', '==', id))),
  ]);
  const refs = [...maint.docs, ...snaps.docs].map((d) => d.ref);
  // Lotes de até 500 operações (limite do Firestore).
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteDoc(doc(col('vehicles'), id));
}

// ---------- Manutenções ----------

export async function listMaintenances(vehicleId: string): Promise<Maintenance[]> {
  const snap = await getDocs(query(col('maintenances'), where('vehicle_id', '==', vehicleId)));
  return snap.docs
    .map((d) => fromDoc<Maintenance>(d))
    .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km);
}

export async function getMaintenance(id: string): Promise<Maintenance> {
  return fromDoc<Maintenance>(await getDoc(doc(col('maintenances'), id)));
}

export async function saveMaintenance(input: MaintenanceInput, id?: string): Promise<void> {
  if (id) await updateDoc(doc(col('maintenances'), id), { ...input });
  else await addDoc(col('maintenances'), { ...input, user_id: currentUid(), created_at: now() });
}

export async function deleteMaintenance(id: string): Promise<void> {
  await deleteDoc(doc(col('maintenances'), id));
}

// ---------- Leituras OBD ----------

export async function saveObdSnapshot(s: Omit<ObdSnapshot, 'id' | 'created_at'>): Promise<void> {
  await addDoc(col('obd_snapshots'), { ...s, created_at: now() });
}

export async function listObdSnapshots(vehicleId: string, limit = 5): Promise<ObdSnapshot[]> {
  const snap = await getDocs(query(col('obd_snapshots'), where('vehicle_id', '==', vehicleId)));
  return snap.docs
    .map((d) => fromDoc<ObdSnapshot>(d))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}
