import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ComponentNode, ScaleType, ScaleModifiers } from '../../types';
import { localizedName } from '../../types';
import { useLang } from '../../i18n';
import './CharacterSheet.css';

const STATS_STORAGE_KEY = 'pham-mech-builder-stats';
const HP_STORAGE_KEY = 'pham-mech-builder-hp';

const MAIN_STATS = [
  { label: 'Dexterity', key: 'dex', modKey: 'dexMod' },
  { label: 'Strength', key: 'str', modKey: 'strMod' },
  { label: 'Constitution', key: 'con', modKey: 'conMod' },
  { label: 'Radiofrequency', key: 'rad', modKey: 'radMod' },
];

const DERIVED_STATS = [
  { label: 'Acrobatics', key: 'acro', from: ['dex', 'str'], modKey: 'acroMod' },
  { label: 'Stealth', key: 'sig', from: ['dex', 'rad'], modKey: 'sigMod' },
  { label: 'Performance', key: 'rend', from: ['con', 'rad'], modKey: 'rendMod' },
];

const EQUIP_STATS = [
  { label: 'Weight', key: 'weight', modKey: 'weight' },
  { label: 'Armor Class', key: 'ac', modKey: 'acMod' },
  { label: 'Movement', key: 'movement', modKey: 'movement' },
];

const CAT_COLORS: Record<string, string> = {
  core: '#4fc3f7',
  utility: '#81c784',
  weapon: '#ef5350',
};

type StatBases = Record<string, number>;

function defaultBases(): StatBases {
  const b: StatBases = {};
  for (const s of MAIN_STATS) b[s.key] = 0;
  return b;
}

function loadBases(): StatBases {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    return raw ? { ...defaultBases(), ...JSON.parse(raw) } : defaultBases();
  } catch {
    return defaultBases();
  }
}

function loadHpMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sumMods(node: ComponentNode | null, modKey: string): number {
  if (!node) return 0;
  const comp = node.component as Record<string, unknown>;
  const val = typeof comp[modKey] === 'number' ? (comp[modKey] as number) : 0;
  let total = val;
  for (const child of node.children) {
    if (child) total += sumMods(child, modKey);
  }
  return total;
}

function sumTotalHp(node: ComponentNode | null, conModifier: number, healthMod: number): number {
  if (!node) return 0;
  const comp = node.component;
  const totalHp = calcHp(conModifier, comp.healthDivisor, healthMod);
  let sum = totalHp;
  for (const child of node.children) {
    if (child) sum += sumTotalHp(child, conModifier, healthMod);
  }
  return sum;
}

function calcModifier(total: number): number {
  return Math.floor((total - 10) / 2);
}

function calcHp(conModifier: number, healthDivisor: number, healthMod: number): number {
  return Math.floor((100 + conModifier + healthMod) / healthDivisor);
}

interface HealthRowProps {
  node: ComponentNode;
  conModifier: number;
  healthMod: number;
  hpMap: Record<string, number>;
  onSetHp: (nodeId: string, value: number) => void;
}

function HealthRow({ node, conModifier, healthMod, hpMap, onSetHp }: HealthRowProps) {
  const comp = node.component;
  const { lang } = useLang();
  const totalHp = useMemo(() => calcHp(conModifier, comp.healthDivisor, healthMod), [conModifier, comp.healthDivisor, healthMod]);
  const currentHp = hpMap[node.id] ?? totalHp;
  const over = currentHp > totalHp;
  const color = CAT_COLORS[comp.category] ?? '#888';
  const [deltaInput, setDeltaInput] = useState('');

  function applyDelta() {
    const raw = deltaInput.trim();
    if (!raw) return;
    if (raw.startsWith('+') || raw.startsWith('-')) {
      const n = Number(raw);
      if (!isNaN(n)) onSetHp(node.id, Math.max(0, currentHp + n));
    } else {
      const n = Number(raw);
      if (!isNaN(n)) onSetHp(node.id, Math.max(0, n));
    }
    setDeltaInput('');
  }

  return (
    <div className="health-tree">
      <div className={`health-row ${currentHp <= 0 ? 'hr-destroyed' : ''}`}>
        <span className="hr-name" title={localizedName(comp, lang)}>{localizedName(comp, lang) || 'Unnamed'}</span>
        <span className="hr-type">
          <span className="hr-type-badge" style={{ background: color }}>{comp.category}</span>
        </span>
        <span className="hr-div">{comp.healthDivisor}</span>
        <span className="hr-current">
          <input
            type="text"
            className="hr-input"
            placeholder="+/-"
            value={deltaInput}
            onChange={e => setDeltaInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyDelta(); }}
            onBlur={applyDelta}
          />
        </span>
        <span className="hr-current" style={{ fontSize: '0.8rem', color: '#667788' }}>
          {currentHp}
        </span>
        <span className={`hr-total ${over ? 'hr-over' : ''}`}>{totalHp}</span>
      </div>
          {node.children.some(Boolean) && (
         <div className="hr-children">
           {node.children.map((child, idx) =>
             child ? (
               <div key={idx} className="hr-slot-group">
                 <HealthRow node={child} conModifier={conModifier} healthMod={healthMod} hpMap={hpMap} onSetHp={onSetHp} />
               </div>
             ) : null,
           )}
         </div>
       )}
    </div>
  );
}

interface CharacterSheetProps {
  mechRoot: ComponentNode | null;
  scale?: ScaleType;
  scaleMods?: Record<ScaleType, ScaleModifiers>;
}

export function CharacterSheet({ mechRoot, scale = 'HG', scaleMods = {} }: CharacterSheetProps) {
  const [bases, setBases] = useState<StatBases>(loadBases);
  const [hpMap, setHpMap] = useState<Record<string, number>>(loadHpMap);

  useEffect(() => {
    const stored = localStorage.getItem(STATS_STORAGE_KEY);
    if (stored) {
      try { setBases({ ...defaultBases(), ...JSON.parse(stored) }); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HP_STORAGE_KEY, JSON.stringify(hpMap));
  }, [hpMap]);

  const currentScaleMods = scaleMods[scale] ?? {};
  const healthMod = (currentScaleMods.healthMod as number) ?? 0;

  const totals = useMemo(() => {
    const t: Record<string, { mod: number; total: number }> = {};
    for (const s of MAIN_STATS) {
      const mod = sumMods(mechRoot, s.modKey) + (currentScaleMods[s.modKey as keyof ScaleModifiers] as number ?? 0);
      const base = bases[s.key] ?? 0;
      t[s.key] = { mod, total: base + mod };
    }
    return t;
  }, [bases, mechRoot, scale, scaleMods]);

  function mainStatTotal(key: string): number {
    return totals[key]?.total ?? 0;
  }

  const derivedTotals = useMemo(() => {
    const d: Record<string, number> = {};
    for (const s of DERIVED_STATS) {
      const srcMod = s.from.reduce((acc, k) => acc + calcModifier(mainStatTotal(k)), 0);
      const bonus = sumMods(mechRoot, s.modKey) + (currentScaleMods[s.modKey as keyof ScaleModifiers] as number ?? 0);
      d[s.key] = srcMod + bonus;
    }
    return d;
  }, [mechRoot, currentScaleMods, totals]);

  const conModifier = useMemo(() => calcModifier(totals.con?.total ?? 0), [totals]);

  const totalMechHp = useMemo(() => sumTotalHp(mechRoot, conModifier, healthMod), [mechRoot, conModifier, healthMod]);

  const setHp = useCallback((nodeId: string, value: number) => {
    setHpMap(prev => ({ ...prev, [nodeId]: value }));
  }, []);

  return (
    <div className="sheet-page">
      <h2>Character Sheet</h2>
      <div className="sheet-content">
        <div className="sheet-health-section">
          <h3>Component Health</h3>
          {!mechRoot ? (
            <p className="placeholder-text">No components in mech</p>
          ) : (
            <div className="health-tree-root">
              <div className="health-header">
                <span className="hr-name">Component</span>
                <span className="hr-type">Type</span>
                <span className="hr-div">Div</span>
                <span className="hr-current">Apply</span>
                <span className="hr-current">Current HP</span>
                <span className="hr-total">Total</span>
              </div>
              <HealthRow node={mechRoot} conModifier={conModifier} healthMod={healthMod} hpMap={hpMap} onSetHp={setHp} />
              <div className="health-row health-total-row">
                <span className="hr-name">Total</span>
                <span className="hr-type" />
                <span className="hr-div" />
                <span className="hr-current" />
                <span className="hr-current" />
                <span className="hr-total">{totalMechHp}</span>
              </div>
            </div>
          )}
        </div>
        <div className="sheet-stats-section">
          <div className="stats-grid">
            <div className="stats-header">
              <span className="stat-col-stat">Stat</span>
              <span className="stat-col-base">Base</span>
              <span className="stat-col-mod">Mech Mod</span>
              <span className="stat-col-total">Total</span>
              <span className="stat-col-mod" style={{ width: 50, textAlign: 'center' }}>Mod</span>
            </div>
            {MAIN_STATS.map(s => {
              const t = totals[s.key];
              const mod = calcModifier(t.total);
              return (
                <div key={s.key} className="stats-row">
                  <span className="stat-col-stat">{s.label}</span>
                  <span className="stat-col-base">{bases[s.key] ?? 0}</span>
                  <span className={`stat-col-mod ${t.mod !== 0 ? 'has-mod' : ''}`}>
                    {t.mod > 0 ? '+' : ''}{t.mod}
                  </span>
                  <span className="stat-col-total">{t.total}</span>
                  <span className="stat-col-mod" style={{ width: 50, textAlign: 'center', fontWeight: 800, color: mod !== 0 ? '#e94560' : '#667788' }}>
                    {mod > 0 ? '+' : ''}{mod}
                  </span>
                </div>
              );
            })}
            <div className="stats-divider" />
            {DERIVED_STATS.map(s => {
              const srcMod = s.from.reduce((acc, k) => acc + calcModifier(mainStatTotal(k)), 0);
              const bonus = sumMods(mechRoot, s.modKey) + (currentScaleMods[s.modKey as keyof ScaleModifiers] as number ?? 0);
              const total = srcMod + bonus;
              return (
                <div key={s.key} className="stats-row">
                  <span className="stat-col-stat">{s.label}</span>
                  <span className={`stat-col-mod ${bonus !== 0 ? 'has-mod' : ''}`}>
                    {bonus > 0 ? '+' : ''}{bonus}
                  </span>
                  <span className="stat-col-total" style={{ width: 'auto', flex: 0, color: '#4fc3f7' }}>
                    {total > 0 ? '+' : ''}{total}
                  </span>
                </div>
              );
            })}
            <div className="stats-divider" />
            {EQUIP_STATS.map(e => {
              let val: number;
              if (e.key === 'ac') {
                const rendMod = calcModifier(derivedTotals['rend'] ?? 0);
                const acroMod = calcModifier(derivedTotals['acro'] ?? 0);
                const acMod = sumMods(mechRoot, 'acMod') + (currentScaleMods['acMod' as keyof ScaleModifiers] as number ?? 0);
                val = rendMod + acroMod + 13 + acMod;
              } else {
                val = sumMods(mechRoot, e.modKey) + (currentScaleMods[e.modKey as keyof ScaleModifiers] as number ?? 0);
              }
              return (
                <div key={e.key} className="stats-row">
                  <span className="stat-col-stat">{e.label}</span>
                  <span className="stat-col-mod" style={{ textAlign: 'left', width: 'auto' }} />
                  <span className="stat-col-total" style={{ width: 'auto', flex: 0 }}>{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}