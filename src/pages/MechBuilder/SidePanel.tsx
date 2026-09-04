import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ComponentNode, ScaleType, ScaleModifiers, ArchetypeOption, ModelOption } from '../../types';
import { localizedArchetypeLabel } from '../../types';
import { useLang } from '../../i18n';
import { SCALES } from '../../data/defaults';
import './SidePanel.css';

const MAIN_STATS = [
  { label: 'Dexterity', key: 'dex' },
  { label: 'Strength', key: 'str' },
  { label: 'Constitution', key: 'con' },
  { label: 'Radiofrequency', key: 'rad' },
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

const STATS_STORAGE_KEY = 'pham-mech-builder-stats';
const ARCHETYPES_STORAGE_KEY = 'pham-mech-builder-archetypes';
const SPEC_STORAGE_KEY = 'pham-mech-builder-spec';
const MODEL_STORAGE_KEY = 'pham-mech-builder-model';

type StatBases = Record<string, number>;

function defaultBases(): StatBases {
  const b: StatBases = {};
  for (const s of MAIN_STATS) b[s.key] = 5;
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

function loadArchetypes(defaults: ArchetypeOption[], lang: string): Set<string> {
  try {
    const raw = localStorage.getItem(ARCHETYPES_STORAGE_KEY);
    if (raw) {
      const arr: string[] = JSON.parse(raw);
      return new Set(arr.filter(a => defaults.some(d => localizedArchetypeLabel(d, lang) === a)));
    }
  } catch {}
  return new Set([localizedArchetypeLabel(defaults[0]!, lang) || 'Striker']);
}

function loadSpec(defaults: ArchetypeOption[], lang: string): string | null {
  try {
    const stored = localStorage.getItem(SPEC_STORAGE_KEY);
    if (stored && defaults.some(d => localizedArchetypeLabel(d, lang) === stored)) return stored;
  } catch {}
  return localizedArchetypeLabel(defaults[0]!, lang) || 'Striker';
}

function loadModel(): string {
  try { return localStorage.getItem(MODEL_STORAGE_KEY) || 'Prototype'; } catch { return 'Prototype'; }
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

function calcModifier(total: number): number {
  return Math.floor((total - 10) / 2);
}

interface SidePanelProps {
  componentPoints?: number;
  mechRoot?: ComponentNode | null;
  scale: ScaleType;
  setScale: (scale: ScaleType) => void;
  scaleMods: Record<ScaleType, ScaleModifiers>;
  setScaleMods: (mods: Record<ScaleType, ScaleModifiers>) => void;
  archetypes: ArchetypeOption[];
  models?: ModelOption[];
  onTotalChange?: (total: number) => void;
  statMin?: number;
  maxStatPoints?: number;
  onStatPointsChange?: (over: number) => void;
  onStatBelowMinChange?: (below: number) => void;
}

export function SidePanel({ componentPoints = 0, mechRoot = null, scale, setScale, scaleMods, setScaleMods, archetypes, models = [], onTotalChange, statMin = 5, maxStatPoints = 27, onStatPointsChange, onStatBelowMinChange }: SidePanelProps) {
  const { lang } = useLang();
  const [bases, setBases] = useState<StatBases>(loadBases);
  const [selected, setSelected] = useState<Set<string>>(() => loadArchetypes(archetypes, lang));
  const [spec, setSpec] = useState<string | null>(() => loadSpec(archetypes, lang));
  const [model, setModel] = useState(() => loadModel());

  useEffect(() => {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(bases));
  }, [bases]);

  useEffect(() => {
    localStorage.setItem(ARCHETYPES_STORAGE_KEY, JSON.stringify([...selected]));
  }, [selected]);

  useEffect(() => {
    if (spec) localStorage.setItem(SPEC_STORAGE_KEY, spec);
    else localStorage.removeItem(SPEC_STORAGE_KEY);
  }, [spec]);

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, [model]);

  const currentScaleMods = scaleMods[scale] ?? {};

  const totals = useMemo(() => {
    const t: Record<string, { mod: number; total: number }> = {};
    for (const s of MAIN_STATS) {
      const mod = sumMods(mechRoot, s.key + 'Mod') + (currentScaleMods[s.key + 'Mod' as keyof ScaleModifiers] as number ?? 0);
      const base = bases[s.key] ?? 0;
      t[s.key] = { mod, total: base + mod };
    }
    return t;
  }, [bases, mechRoot, scale, currentScaleMods]);

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
  }, [totals, mechRoot, currentScaleMods]);

  function setBase(key: string, val: string) {
    const n = val === '' ? 0 : Number(val);
    setBases(prev => ({ ...prev, [key]: n }));
  }

  useEffect(() => {
    const numStats = MAIN_STATS.length;
    const used = Object.values(bases).reduce((s, v) => s + v, 0) - statMin * numStats;
    const over = Math.max(0, used - maxStatPoints);
    onStatPointsChange?.(over);
    const below = MAIN_STATS.filter(s => (bases[s.key] ?? 0) < statMin).length;
    onStatBelowMinChange?.(below);
  }, [bases, statMin, maxStatPoints, onStatPointsChange, onStatBelowMinChange]);

  const scaleModelNames = useMemo(
    () => models.filter(m => m.scales.includes(scale)).map(m => m.name),
    [models, scale],
  );
  const currentModelValid = scaleModelNames.includes(model);
  const resolvedModel = currentModelValid ? model : scaleModelNames[0];

  const handleLeftClick = useCallback((label: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const handleRightClick = useCallback((e: React.MouseEvent, label: string) => {
    e.preventDefault();
    setSpec(prev => prev === label ? null : label);
    setSelected(prev => {
      if (prev.has(label)) return prev;
      return new Set([...prev, label]);
    });
  }, []);

  const scaleNames = useMemo(
    () =>
      [...(SCALES as readonly string[]), ...Object.keys(scaleMods).filter(s => !(SCALES as readonly string[]).includes(s))],
    [scaleMods],
  );

  const archetypeCost = archetypes
    .filter(a => selected.has(localizedArchetypeLabel(a, lang)))
    .reduce((s, a) => s + a.cost, 0);

  const total = archetypeCost + componentPoints;

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  return (
    <div className="side-panel">
      <h2>Mech Info</h2>

      <div className="meta-group">
        <div className="meta-group-label">Stats</div>
        <div className="panel-stats">
          {MAIN_STATS.map(s => {
            const t = totals[s.key];
            const mod = calcModifier(t.total);
            return (
              <div key={s.key} className="panel-stat-row">
                <span className="panel-stat-label">{s.label}</span>
                <input
                  type="number"
                  className="panel-stat-input"
                  value={bases[s.key] ?? 0}
                  onChange={e => setBase(s.key, e.target.value)}
                />
                <span className={`panel-stat-mod ${t.mod !== 0 ? 'has-mod' : ''}`}>
                  {t.mod > 0 ? '+' : ''}{t.mod}
                </span>
                <span className="panel-stat-total">{t.total}</span>
                <span className="panel-stat-mod" style={{ width: 36, textAlign: 'center', fontWeight: 800, color: mod !== 0 ? '#e94560' : '#667788' }}>
                  {mod > 0 ? '+' : ''}{mod}
                </span>
              </div>
            );
          })}
          <div className="panel-stat-divider" />
          {DERIVED_STATS.map(s => {
            const srcMod = s.from.reduce((acc, k) => acc + calcModifier(mainStatTotal(k)), 0);
            const bonus = sumMods(mechRoot, s.modKey) + (currentScaleMods[s.modKey as keyof ScaleModifiers] as number ?? 0);
            const total = srcMod + bonus;
            return (
              <div key={s.key} className="panel-stat-row">
                <span className="panel-stat-label">{s.label}</span>
                <span className={`panel-stat-mod ${bonus !== 0 ? 'has-mod' : ''}`}>
                  {bonus > 0 ? '+' : ''}{bonus}
                </span>
                <span className="panel-stat-total" style={{ width: 'auto', flex: 0, color: '#4fc3f7' }}>
                  {total > 0 ? '+' : ''}{total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-stat-divider" />

      <div className="meta-group">
        <div className="meta-group-label">Equipment</div>
        <div className="panel-stats">
          {EQUIP_STATS.map(e => {
            let val: number;
            if (e.key === 'ac') {
              const rendMod = calcModifier(derivedTotals['rend'] ?? 0);
              const acroMod = calcModifier(derivedTotals['acro'] ?? 0);
              const acMod = sumMods(mechRoot, 'acMod') + (currentScaleMods['acMod' as keyof ScaleModifiers] as number ?? 0);
              val = rendMod + acroMod + 13 + acMod;
            } else if (e.key === 'movement') {
              const perfMod = derivedTotals['rend'] ?? 0;
              const acroMod = derivedTotals['acro'] ?? 0;
              const compMovement = sumMods(mechRoot, 'movement') + (currentScaleMods['movement' as keyof ScaleModifiers] as number ?? 0);
              val = (perfMod + acroMod) * 5 + 30 + compMovement;
            } else {
              val = sumMods(mechRoot, e.modKey) + (currentScaleMods[e.modKey as keyof ScaleModifiers] as number ?? 0);
            }
            return (
              <div key={e.key} className="panel-stat-row">
                <span className="panel-stat-label">{e.label}</span>
                <span className="panel-stat-total" style={{ width: 'auto', flex: 0 }}>{val}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="meta-group">
        <div className="meta-group-label">Archetypes</div>
        <div className="meta-items">
           {archetypes.map(a => {
             const label = localizedArchetypeLabel(a, lang);
             const isSelected = selected.has(label);
             const isSpec = spec === label;
             return (
               <button
                 key={label}
                 className={`meta-item ${isSelected ? 'on' : ''} ${isSpec ? 'spec' : ''}`}
                 onClick={() => handleLeftClick(label)}
                 onContextMenu={e => handleRightClick(e, label)}
               >
                <span className="meta-marker">
                  {isSpec ? '★' : isSelected ? '[x]' : '[ ]'}
                </span>
                <span>{localizedArchetypeLabel(a, lang)}</span>
                <span className="meta-pts">{a.cost}p</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="meta-group">
        <div className="meta-group-label">Scale</div>
        <div className="meta-items">
          {scaleNames.map(s => {
            const on = scale === s;
            return (
              <button
                key={s}
                className={`meta-item ${on ? 'on' : ''}`}
                onClick={() => {
                  setScale(s);
                  setModel(on ? model : models.find(m => m.scales.includes(s))?.name ?? '');
                }}
              >
                <span className="meta-marker">{on ? '◉' : '○'}</span>
                <span>{s}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="meta-group">
        <div className="meta-group-label">Scale Modifiers</div>
        <div className="panel-stats">
          {(Object.keys(currentScaleMods) as Array<keyof ScaleModifiers>).map(key => {
            const val = currentScaleMods[key];
            return val !== undefined && val !== 0 ? (
              <div key={key} className="panel-stat-row" style={{ fontSize: '0.8rem' }}>
                <span className="panel-stat-label" style={{ flex: 1 }}>{key.replace('Mod', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="panel-stat-total" style={{ width: 'auto', flex: 0, color: val > 0 ? '#4fc3f7' : '#ef5350' }}>
                  {val > 0 ? '+' : ''}{val}
                </span>
              </div>
            ) : null;
          })}
        </div>
      </div>

      <div className="meta-group">
        <div className="meta-group-label">Model</div>
        <div className="meta-items">
          {scaleModelNames.map(m => {
            const on = resolvedModel === m;
            return (
              <button
                key={m}
                className={`meta-item ${on ? 'on' : ''}`}
                onClick={() => setModel(m)}
              >
                <span className="meta-marker">{on ? '◉' : '○'}</span>
                <span>{m}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="meta-total">
        <div className="meta-total-row">
          <span>Archetypes</span>
          <span>{archetypeCost} pts</span>
        </div>
        <div className="meta-total-row">
          <span>Components</span>
          <span>{componentPoints} pts</span>
        </div>
        <div className="meta-total-row meta-total-final">
          <span>Total</span>
          <strong>{total} pts</strong>
        </div>
      </div>
    </div>
  );
}
