import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Ícone de cada item do plano de manutenção (chave = id em lib/maintenance.ts). */
const MAINTENANCE_ICONS: Record<string, IconName> = {
  oleo: 'oil',
  filtro_ar: 'air-filter',
  filtro_cabine: 'air-conditioner',
  filtro_comb: 'gas-station',
  velas: 'flash',
  correia_dentada: 'cog',
  correia_acess: 'sync',
  pastilhas: 'car-brake-alert',
  discos: 'disc',
  fluido_freio: 'car-brake-fluid-level',
  arrefecimento: 'car-coolant-level',
  alinhamento: 'car-traction-control',
  rodizio: 'rotate-3d-variant',
  pneus: 'tire',
  bateria: 'car-battery',
  amortecedores: 'car-cog',
  oleo_cambio: 'car-shift-pattern',
  bicos: 'spray',
  higienizacao_ac: 'fan',
  palhetas: 'wiper',
  embreagem: 'car-clutch',
  revisao: 'clipboard-check',
};

/** Ícone por nome (itens do plano, consertos da corretiva e categorias de estética). */
const NAME_ICONS: Record<string, IconName> = {
  // Corretiva
  Motor: 'engine',
  'Câmbio / embreagem': 'car-shift-pattern',
  Suspensão: 'car-cog',
  Freios: 'car-brake-abs',
  Direção: 'steering',
  'Elétrica / bateria': 'flash',
  'Injeção eletrônica': 'car-turbocharger',
  'Ar-condicionado': 'snowflake',
  'Arrefecimento / radiador': 'radiator',
  Escapamento: 'smoke',
  'Pneu furado / estourado': 'car-tire-alert',
  'Funilaria / batida': 'hammer-wrench',
  'Vidros / travas': 'car-door',
  'Iluminação / lâmpadas': 'lightbulb',
  // Estética
  'Bancos / interior': 'car-seat',
  'Volante / painel': 'steering',
  'Faróis / lanternas': 'car-light-high',
  'Iluminação (LED, xenon)': 'led-on',
  Rodas: 'tire',
  Pneus: 'tire',
  'Som / multimídia': 'speaker',
  'Película (insulfilm)': 'window-shutter',
  'Pintura / envelopamento': 'format-paint',
  'Para-choques / kit visual': 'car-sports',
  'Grade / emblemas': 'shield-car',
  'Suspensão (rebaixamento)': 'car-lifted-pickup',
  'Escapamento esportivo': 'smoke',
  'Tapetes / capas': 'rug',
  'Câmera / sensor de ré': 'camera-rear',
  Acessórios: 'car-key',
  Outro: 'wrench',
};

export function maintenanceIcon(typeId: string | undefined): IconName {
  return (typeId && MAINTENANCE_ICONS[typeId]) || 'wrench';
}

export function iconForName(name: string, typeId?: string): IconName {
  return (typeId && MAINTENANCE_ICONS[typeId]) || NAME_ICONS[name] || 'wrench';
}
