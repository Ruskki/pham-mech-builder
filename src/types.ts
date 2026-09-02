export type ComponentCategory = 'core' | 'utility' | 'weapon';

export type ScaleType = string;

export type Language = string;

export interface LocalizedEntry {
  [langCode: string]: { name: string; description: string };
}

export interface LocalizedArchetype {
  [langCode: string]: { label: string };
}

export function localizedName(
  comp: { name: string; languages?: LocalizedEntry },
  lang: string,
): string {
  const entry = comp.languages?.[lang];
  if (entry?.name) return entry.name;
  const fallback = comp.languages?.['en'];
  if (fallback?.name) return fallback.name;
  return comp.name;
}

export function localizedDesc(
  comp: { description: string; languages?: LocalizedEntry },
  lang: string,
): string {
  const entry = comp.languages?.[lang];
  if (entry?.description) return entry.description;
  const fallback = comp.languages?.['en'];
  if (fallback?.description) return fallback.description;
  return comp.description;
}

export function localizedArchetypeLabel(
  arch: { label: string; languages?: LocalizedArchetype },
  lang: string,
): string {
  const entry = arch.languages?.[lang];
  if (entry?.label) return entry.label;
  const fallback = arch.languages?.['en'];
  if (fallback?.label) return fallback.label;
  return arch.label;
}

export interface ArchetypeOption {
  label: string;
  cost: number;
  languages?: LocalizedArchetype;
}

export interface ModelOption {
  name: string;
  scales: ScaleType[];
}

export interface ScaleModifiers {
  dexMod?: number;
  strMod?: number;
  conMod?: number;
  radMod?: number;
  acMod?: number;
  acroMod?: number;
  sigMod?: number;
  rendMod?: number;
  movement?: number;
  weight?: number;
  healthMod?: number;
}

export function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export interface BaseComponentFields {
  id: number;
  name: string;
  description: string;
  healthDivisor: number;
  slots: number;
  type: string;
  points: number;
  attrRange?: string;
  weight?: number;
  dexMod?: number;
  strMod?: number;
  radMod?: number;
  conMod?: number;
  acMod?: number;
  acroMod?: number;
  sigMod?: number;
  rendMod?: number;
  movement?: number;
  maxCount?: number;
  languages?: LocalizedEntry;
}

export interface CoreComponent extends BaseComponentFields {
  category: 'core';
}

export interface UtilityComponent extends BaseComponentFields {
  category: 'utility';
  actionType: string;
  range: string;
  energy: number;
  oneTimeUse?: boolean;
}

export interface WeaponComponent extends BaseComponentFields {
  category: 'weapon';
  actionType: string;
  range: string;
  ammoType: string;
  ammoCost: number;
  weaponType: string;
  weaponSubtype: string;
}

export type MechComponent = CoreComponent | UtilityComponent | WeaponComponent;

export interface ComponentNode {
  id: string;
  component: MechComponent;
  children: (ComponentNode | null)[];
}

let idCounter = 0;
export function generateId(): string {
  return `comp-${++idCounter}`;
}

export function defaultComponent(category: ComponentCategory): MechComponent {
  const base = {
    id: 0,
    name: '',
    description: '',
    healthDivisor: 1,
    slots: 0,
    type: '',
    points: 0,
  };
  switch (category) {
    case 'core':
      return { ...base, category: 'core' };
    case 'utility':
      return { ...base, category: 'utility', actionType: '', range: '', energy: 0 };
    case 'weapon':
      return { ...base, category: 'weapon', actionType: '', range: '', ammoType: '', ammoCost: 0, weaponType: '', weaponSubtype: '' };
  }
}

export function createNode(component: MechComponent): ComponentNode {
  return {
    id: generateId(),
    component,
    children: new Array(component.slots).fill(null),
  };
}

export function countComponentById(node: ComponentNode | null, targetId: number): number {
  if (!node) return 0;
  let count = node.component.id === targetId ? 1 : 0;
  for (const child of node.children) count += countComponentById(child, targetId);
  return count;
}

export function addToSlot(
  root: ComponentNode,
  parentId: string,
  slotIndex: number,
  newNode: ComponentNode,
): ComponentNode {
  if (root.id === parentId) {
    const children = [...root.children];
    children[slotIndex] = newNode;
    return { ...root, children };
  }
  return {
    ...root,
    children: root.children.map(c => c ? addToSlot(c, parentId, slotIndex, newNode) : null),
  };
}

export function removeById(root: ComponentNode, id: string): ComponentNode | null {
  if (root.id === id) return null;
  return {
    ...root,
    children: root.children.map(c => {
      if (!c) return null;
      if (c.id === id) return null;
      return removeById(c, id);
    }),
  };
}

export interface PremadeData {
  id: number;
  name: string;
  description: string;
  healthDivisor: number;
  slots: number;
  type: string;
  points: number;
  attrRange?: string;
  weight?: number;
  dexMod?: number;
  strMod?: number;
  radMod?: number;
  conMod?: number;
  acMod?: number;
  acroMod?: number;
  sigMod?: number;
  rendMod?: number;
  movement?: number;
  category: ComponentCategory;
  actionType?: string;
  range?: string;
  energy?: number;
  oneTimeUse?: boolean;
  ammoType?: string;
  ammoCost?: number;
  weaponType?: string;
  weaponSubtype?: string;
  maxCount?: number;
  languages?: LocalizedEntry;
}

export function defaultPremade(category: ComponentCategory, id = 0): PremadeData {
  return {
    id, name: '', description: '', healthDivisor: 1, slots: 0, type: '', points: 0,
    category,
  };
}

export function premadeToComponent(data: PremadeData): MechComponent {
  const base = {
    id: data.id,
    name: data.name,
    description: data.description,
    healthDivisor: data.healthDivisor,
    slots: data.slots,
    type: data.type,
    points: data.points,
    attrRange: data.attrRange,
    weight: data.weight,
    dexMod: data.dexMod,
    strMod: data.strMod,
    radMod: data.radMod,
    conMod: data.conMod,
    acMod: data.acMod,
    acroMod: data.acroMod,
    sigMod: data.sigMod,
    rendMod: data.rendMod,
    movement: data.movement,
    maxCount: data.maxCount,
    languages: data.languages,
  };
  switch (data.category) {
    case 'core':
      return { ...base, category: 'core' };
    case 'utility':
      return {
        ...base,
        category: 'utility',
        actionType: data.actionType ?? '',
        range: data.range ?? '',
        energy: data.energy ?? 0,
        oneTimeUse: data.oneTimeUse,
      };
    case 'weapon':
      return {
        ...base,
        category: 'weapon',
        actionType: data.actionType ?? '',
        range: data.range ?? '',
        ammoType: data.ammoType ?? '',
        ammoCost: data.ammoCost ?? 0,
        weaponType: data.weaponType ?? '',
        weaponSubtype: data.weaponSubtype ?? '',
      };
  }
}

export interface CompactNode {
  id: string;
  componentId: number;
  children: (CompactNode | null)[];
}

export interface StoredBuild {
  customs: PremadeData[];
  tree: CompactNode;
}

export function buildPremadeLib(premade: Record<string, PremadeData[]>): Record<number, PremadeData> {
  const lib: Record<number, PremadeData> = {};
  for (const cat of ['core', 'utility', 'weapon']) {
    for (const p of premade[cat] ?? []) {
      lib[p.id] = { ...p, category: cat as ComponentCategory };
    }
  }
  return lib;
}

export function mergePremades(
  base: Record<string, PremadeData[]>,
  edits: Record<number, PremadeData>,
): Record<string, PremadeData[]> {
  const byCat: Record<string, PremadeData[]> = {};
  for (const [cat, comps] of Object.entries(base)) {
    for (const c of comps ?? []) {
      const edit = edits[c.id];
      const merged = edit ? { ...c, ...edit } : { ...c };
      const finalCat = merged.category ?? cat;
      merged.category = finalCat;
      (byCat[finalCat] ??= []).push(merged);
    }
  }
  return byCat;
}

export function compactTree(node: ComponentNode): CompactNode {
  return {
    id: node.id,
    componentId: node.component.id,
    children: node.children.map(c => (c ? compactTree(c) : null)),
  };
}

export function expandTree(
  node: CompactNode,
  lib: Record<number, MechComponent>,
): ComponentNode {
  const comp = lib[node.componentId];
  if (!comp) {
    return {
      id: node.id,
      component: { ...defaultComponent('core'), name: `[Missing ID ${node.componentId}]` } as MechComponent,
      children: node.children.map(c => (c ? expandTree(c, lib) : null)),
    };
  }
  return {
    id: node.id,
    component: comp,
    children: node.children.map(c => (c ? expandTree(c, lib) : null)),
  };
}

export function componentToPremade(comp: MechComponent): PremadeData {
  return comp as unknown as PremadeData;
}

export function collectCustomIds(
  node: ComponentNode,
  premadeIds: Set<number>,
  ids: Set<number>,
): void {
  if (!premadeIds.has(node.component.id)) ids.add(node.component.id);
  for (const c of node.children) if (c) collectCustomIds(c, premadeIds, ids);
}
