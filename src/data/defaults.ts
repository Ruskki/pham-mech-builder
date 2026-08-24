import type { ScaleModifiers, ArchetypeOption, ModelOption } from '../types';

export const SCALES = ['SD', 'HG', 'MG', 'PG'] as const;

export const DEFAULT_SCALE_MODIFIERS: Record<string, ScaleModifiers> = {
  SD: { dexMod: 2, strMod: -2, conMod: -1, radMod: 1, movement: 5 },
  HG: {},
  MG: { strMod: 2, conMod: 1, dexMod: -1, weight: 10 },
  PG: { strMod: 3, conMod: 2, dexMod: -2, radMod: -1, weight: 25, movement: -5, healthMod: 100 },
};

export const DEFAULT_ARCHETYPES: ArchetypeOption[] = [
  { label: 'Striker', cost: 3 },
  { label: 'Tank', cost: 4 },
  { label: 'Support', cost: 2 },
  { label: 'Scout', cost: 2 },
  { label: 'Artillery', cost: 5 },
  { label: 'Stealth', cost: 4 },
];

const SD_MODELS = ['Beacon', 'Kilo-ton', 'Black Flash', 'Ex-calibur'];
const STD_MODELS = ['Prototype', 'Mass Production', 'Biotype'];

export const DEFAULT_MODELS: ModelOption[] = [
  ...SD_MODELS.map(name => ({ name, scales: ['SD'] })),
  ...STD_MODELS.map(name => ({ name, scales: [...SCALES] })),
];

export const MOD_KEYS: (keyof ScaleModifiers)[] = [
  'dexMod', 'strMod', 'conMod', 'radMod',
  'acMod', 'acroMod', 'sigMod', 'rendMod',
  'movement', 'weight', 'healthMod',
];

export const MOD_LABELS: Record<keyof ScaleModifiers, string> = {
  dexMod: 'Dex',
  strMod: 'Str',
  conMod: 'Con',
  radMod: 'Rad',
  acMod: 'AC',
  acroMod: 'Acro',
  sigMod: 'Sig',
  rendMod: 'Rend',
  movement: 'Movement',
  weight: 'Weight',
  healthMod: 'Health',
};
