import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ComponentNode } from '../../types';
import './SidePanel.css';

interface ArchetypeOption {
  label: string;
  cost: number;
}

const ARCHETYPES: ArchetypeOption[] = [
  { label: 'Striker', cost: 3 },
  { label: 'Tank', cost: 4 },
  { label: 'Support', cost: 2 },
  { label: 'Scout', cost: 2 },
  { label: 'Artillery', cost: 5 },
  { label: 'Stealth', cost: 4 },
];

const SD_MODELS = ['Beacon', 'Kilo-ton', 'Black Flash', 'Ex-calibur'];
const STD_MODELS = ['Prototype', 'Mass Production', 'Biotype'];

const SCALES = ['SD', 'HG', 'MG', 'PG'];

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
}

export function SidePanel({ componentPoints = 0, mechRoot = null }: SidePanelProps) {
  const [bases, setBases] = useState<StatBases>(loadBases);
  const [selected, setSelected] = useState<Set<string>>(new Set(['Striker']));
  const [spec, setSpec] = useState<string | null>('Striker');
  const [scale, setScale] = useState('HG');
  const [model, setModel] = useState('Prototype');

  useEffect(() => {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(bases));
  }, [bases]);

  const totals = useMemo(() => {
    const t: Record<string, { mod: number; total: number }> = {};
    for (const s of MAIN_STATS) {
      const mod = sumMods(mechRoot, s.key + 'Mod');
      const base = bases[s.key] ?? 0;
      t[s.key] = { mod, total: base + mod };
    }
    return t;
  }, [bases, mechRoot]);

  function mainStatTotal(key: string): number {
    return totals[key]?.total ?? 0;
  }

  function setBase(key: string, val: string) {
    const n = val === '' ? 0 : Number(val);
    setBases(prev => ({ ...prev, [key]: n }));
  }

  const models = scale === 'SD' ? [...SD_MODELS, ...STD_MODELS] : STD_MODELS;
  const currentModelValid = models.includes(model);
  const resolvedModel = currentModelValid ? model : models[0];

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

  const archetypeCost = ARCHETYPES
    .filter(a => selected.has(a.label))
    .reduce((s, a) => s + a.cost, 0);

  const total = archetypeCost + componentPoints;

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
            const bonus = sumMods(mechRoot, s.modKey);
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
            const val = sumMods(mechRoot, e.modKey);
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
          {ARCHETYPES.map(a => {
            const isSelected = selected.has(a.label);
            const isSpec = spec === a.label;
            return (
              <button
                key={a.label}
                className={`meta-item ${isSelected ? 'on' : ''} ${isSpec ? 'spec' : ''}`}
                onClick={() => handleLeftClick(a.label)}
                onContextMenu={e => handleRightClick(e, a.label)}
              >
                <span className="meta-marker">
                  {isSpec ? '★' : isSelected ? '[x]' : '[ ]'}
                </span>
                <span>{a.label}</span>
                <span className="meta-pts">{a.cost}p</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="meta-group">
        <div className="meta-group-label">Scale</div>
        <div className="meta-items">
          {SCALES.map(s => {
            const on = scale === s;
            return (
              <button
                key={s}
                className={`meta-item ${on ? 'on' : ''}`}
                onClick={() => {
                  setScale(s);
                  setModel(on ? model : (s === 'SD' ? SD_MODELS[0] : STD_MODELS[0]));
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
        <div className="meta-group-label">Model</div>
        <div className="meta-items">
          {models.map(m => {
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
