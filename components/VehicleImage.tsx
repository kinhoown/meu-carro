import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { CarArt } from './CarArt';
import { colors } from './ui';
import { findCarPhoto, PHOTO_SEARCH_VERSION, WIKI_HEADERS } from '@/lib/carPhoto';
import { updateVehicle } from '@/lib/db';
import type { Vehicle } from '@/lib/types';
import { guessBody } from '@/lib/vehicleLook';

// Evita buscar a mesma foto duas vezes ao mesmo tempo (lista + detalhe).
const pending = new Map<string, Promise<void>>();

/**
 * Foto real do modelo do carro. Na primeira vez busca no Wikimedia e salva no veículo;
 * se não achar (ou o usuário preferir), mostra o desenho.
 */
export function VehicleImage({
  vehicle,
  height = 170,
  onUpdated,
}: {
  vehicle: Vehicle;
  height?: number;
  onUpdated?: (patch: Partial<Vehicle>) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [searching, setSearching] = useState(false);
  // Foto achada nesta tela (aparece mesmo se a gravação no banco falhar).
  const [found, setFound] = useState<string | null>(null);
  const wantsPhoto = vehicle.photo_mode !== 'desenho';
  // Busca de novo se nunca buscou, ou se a foto foi escolhida sozinha por uma busca antiga.
  // photo_v = 0 marca foto escolhida por você em "Trocar imagem": essa fica como está.
  const needsSearch =
    wantsPhoto &&
    (vehicle.photo_url === undefined || (vehicle.photo_v !== 0 && vehicle.photo_v !== PHOTO_SEARCH_VERSION));

  useEffect(() => {
    if (!needsSearch) return;
    setSearching(true);
    let job = pending.get(vehicle.id);
    if (!job) {
      job = findCarPhoto(vehicle.brand, vehicle.model, vehicle.year_model)
        .then(async (photo) => {
          const patch = { photo_url: photo?.url ?? null, photo_title: photo?.title ?? null, photo_v: PHOTO_SEARCH_VERSION };
          setFound(photo?.url ?? null);
          onUpdated?.(patch);
          await updateVehicle(vehicle.id, patch);
        })
        .catch((e) => console.warn('Foto do carro:', e?.message)) // sem internet: tenta de novo na próxima vez
        .finally(() => pending.delete(vehicle.id));
      pending.set(vehicle.id, job);
    }
    job.finally(() => setSearching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id, needsSearch]);

  useEffect(() => setFailed(false), [vehicle.photo_url]);

  const url = found ?? vehicle.photo_url;
  if (wantsPhoto && url && !failed) {
    return (
      <View>
        <Image
          source={{ uri: url, headers: WIKI_HEADERS }}
          onError={(e) => {
            console.warn('Imagem do carro:', e.nativeEvent?.error);
            setFailed(true);
          }}
          style={{ width: '100%', height, borderRadius: 10, backgroundColor: colors.chip }}
          resizeMode="cover"
        />
        <Text style={{ position: 'absolute', right: 8, bottom: 6, color: '#fff', fontSize: 10, textShadowColor: '#000', textShadowRadius: 3 }}>
          Foto: Wikimedia Commons
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      <CarArt body={vehicle.body ?? guessBody(vehicle.model)} color={vehicle.color} width={Math.min(300, height * 1.9)} />
      {searching && <ActivityIndicator color={colors.primary} style={{ position: 'absolute', top: 6, right: 6 }} />}
    </View>
  );
}
