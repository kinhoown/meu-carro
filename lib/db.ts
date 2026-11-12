import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
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
import type { Maintenance, MaintenanceInput, Mod, ModInput, NewVehicle, ObdSnapshot, PlanEntry, Vehicle } from './types';

/**
 * Firestore, um "cantinho" por usuário (ver firestore.rules):
 *   users/{uid}/vehicles/{id}
 *   users/{uid}/maintenances/{id}     (campo vehicle_id)
 *   users/{uid}/obd_snapshots/{id}    (campo vehicle_id)
 *   users/{uid}/mods/{id}             (estética / modificações, campo vehicle_id)
 * Consultas usam só igualdade em um campo e ordenam no celular, para não precisar
 * criar índices compostos no console do Firebase.
 */
const col = (name: 'vehicles' | 'maintenances' | 'obd_snapshots' | 'mods') =>
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
  const related = await Promise.all(
    (['maintenances', 'obd_snapshots', 'mods'] as const).map((c) =>
      getDocs(query(col(c), where('vehicle_id', '==', id))),
    ),
  );
  const refs = related.flatMap((snap) => snap.docs.map((d) => d.ref));
  // Lotes de até 500 operações (limite do Firestore).
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteDoc(doc(col('vehicles'), id));
}

/**
 * Grava a próxima troca de um item do plano (ou null para voltar ao cálculo automático).
 * Usa FieldPath porque o Firestore não aceita "/" e "." em caminhos de texto.
 */
export async function setPlanEntry(vehicleId: string, typeId: string, entry: PlanEntry | null): Promise<void> {
  await updateDoc(doc(col('vehicles'), vehicleId), new FieldPath('plan', typeId), entry ?? deleteField());
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

// ---------- Estética / modificações ----------

export async function listMods(vehicleId: string): Promise<Mod[]> {
  const snap = await getDocs(query(col('mods'), where('vehicle_id', '==', vehicleId)));
  // Planejados primeiro, depois os feitos do mais recente para o mais antigo.
  return snap.docs
    .map((d) => fromDoc<Mod>(d))
    .sort(
      (a, b) =>
        (a.status === 'planejado' ? 0 : 1) - (b.status === 'planejado' ? 0 : 1) ||
        (b.date ?? b.created_at).localeCompare(a.date ?? a.created_at),
    );
}

export async function getMod(id: string): Promise<Mod> {
  return fromDoc<Mod>(await getDoc(doc(col('mods'), id)));
}

export async function saveMod(input: ModInput, id?: string): Promise<void> {
  if (id) await updateDoc(doc(col('mods'), id), { ...input });
  else await addDoc(col('mods'), { ...input, user_id: currentUid(), created_at: now() });
}

export async function deleteMod(id: string): Promise<void> {
  await deleteDoc(doc(col('mods'), id));
}
