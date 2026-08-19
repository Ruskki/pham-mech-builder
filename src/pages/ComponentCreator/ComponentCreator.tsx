import { useState, useRef } from 'react';
import type { PremadeData, ComponentCategory } from '../../types';
import { defaultPremade, normalizeStr } from '../../types';
import allComponents from '../../data/components.json';
import './ComponentCreator.css';

interface ComponentCreatorProps {
  customComponents: PremadeData[];
  onAdd: (comp: PremadeData) => void;
  onUpdate: (index: number, comp: PremadeData) => void;
  onRemove: (index: number) => void;
}

const CATEGORIES: ComponentCategory[] = ['core', 'utility', 'weapon'];
const CAT_COLORS: Record<string, string> = { core: '#4fc3f7', utility: '#81c784', weapon: '#ef5350' };
const ACTION_TYPES = ['action', 'bonus', 'reaction'];

interface LibraryEntry {
  data: PremadeData;
  kind: 'premade' | 'custom';
  customIdx?: number;
  group: ComponentCategory;
}

export function ComponentCreator({ customComponents, onAdd, onUpdate, onRemove }: ComponentCreatorProps) {
  const [search, setSearch] = useState('');
  const [editingCustomIdx, setEditingCustomIdx] = useState<number | null>(null);
  const [form, setForm] = useState<PremadeData>(defaultPremade('core'));

  const premade = allComponents as Record<string, PremadeData[]>;

  function nextId(): number {
    let max = 0;
    for (const cat of CATEGORIES) {
      for (const c of (premade[cat] ?? [])) {
        if (c.id > max) max = c.id;
      }
    }
    for (const c of customComponents) {
      if (c.id > max) max = c.id;
    }
    return max + 1;
  }

  const allEntries: LibraryEntry[] = [
    ...CATEGORIES.flatMap(cat =>
      (premade[cat] ?? []).map(c => ({ data: { ...c, category: cat }, kind: 'premade' as const, group: cat })),
    ),
    ...customComponents.map((c, i) => ({
      data: c, kind: 'custom' as const, customIdx: i, group: c.category,
    })),
  ];

  const filtered = search
    ? allEntries.filter(e => normalizeStr(e.data.name).includes(normalizeStr(search)))
    : allEntries;

  const grouped = CATEGORIES.map(cat => ({
    category: cat,
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    color: CAT_COLORS[cat] ?? '#888',
    entries: filtered.filter(e => e.group === cat),
  })).filter(g => g.entries.length > 0);

  function setField<K extends keyof PremadeData>(key: K, value: PremadeData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function select(entry: LibraryEntry) {
    if (entry.kind === 'custom' && entry.customIdx !== undefined) {
      setEditingCustomIdx(entry.customIdx);
    } else {
      setEditingCustomIdx(null);
    }
    setForm({ ...entry.data });
  }

  const isEditingPremade = editingCustomIdx === null && form.id > 0;

  function handleSave() {
    if (editingCustomIdx !== null) {
      onUpdate(editingCustomIdx, form);
    } else {
      onAdd({ ...form, id: nextId() });
    }
  }

  function handleSaveAsNew() {
    onAdd({ ...form, id: nextId() });
  }

  function handleDelete() {
    if (editingCustomIdx !== null) {
      onRemove(editingCustomIdx);
      setEditingCustomIdx(null);
      setForm(defaultPremade('core'));
    }
  }

  const importRef = useRef<HTMLInputElement>(null);

  function handleNew() {
    setEditingCustomIdx(null);
    setForm(defaultPremade('core'));
  }

  function exportComponents() {
    if (customComponents.length === 0) return;
    const blob = new Blob([JSON.stringify(customComponents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-components.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (Array.isArray(data)) {
          for (const comp of data) onAdd({ ...comp, id: comp.id || nextId() });
        }
      } catch { /* ignore */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="creator-page">
      <aside className="creator-library">
        <div className="creator-lib-header">
          <h3>Library</h3>
          <input
            className="creator-search"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="creator-lib-list">
          {grouped.map(g => (
            <div key={g.category}>
              <div className="creator-lib-group" style={{ color: g.color }}>
                {g.label}
              </div>
              {g.entries.map((entry, i) => {
                const sel =
                  entry.kind === 'custom'
                    ? editingCustomIdx === entry.customIdx
                    : editingCustomIdx === null && form.name === entry.data.name && form.category === entry.data.category;
                return (
                  <button
                    key={`${entry.kind}-${entry.data.name}-${i}`}
                    className={`creator-lib-item ${sel ? 'sel' : ''}`}
                    onClick={() => select(entry)}
                  >
                    <span className="creator-lib-name">{entry.data.name}</span>
                    {entry.kind === 'custom' && <span className="creator-lib-badge">custom</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="creator-lib-empty">No components</div>
          )}
        </div>
      </aside>

      <div className="creator-editor">
        <div className="creator-editor-header">
          <h3>Editor</h3>
          <div className="creator-editor-actions">
            <input ref={importRef} type="file" accept=".json" onChange={handleImport} hidden />
            <button className="creator-btn creator-btn-io" onClick={() => importRef.current?.click()}>
              Import
            </button>
            <button className="creator-btn creator-btn-io" onClick={exportComponents} disabled={customComponents.length === 0}>
              Export
            </button>
            <button className="creator-btn creator-btn-new" onClick={handleNew}>
              + New
            </button>
          </div>
        </div>

        <div className="category-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`cat-tab ${form.category === cat ? 'active' : ''}`}
              onClick={() => {
                setForm(prev => defaultPremade(cat));
                setEditingCustomIdx(null);
              }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="creator-form">
          <label>
            Name
            <input value={form.name} onChange={e => setField('name', e.target.value)} />
          </label>

          <label>
            Description
            <textarea
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              rows={2}
            />
          </label>

          <div className="form-row">
            <label>
              HP Divisor
              <input
                type="number" min={1}
                value={form.healthDivisor}
                onChange={e => setField('healthDivisor', Number(e.target.value))}
              />
            </label>
            <label>
              Slots
              <input
                type="number" min={0}
                value={form.slots}
                onChange={e => setField('slots', Number(e.target.value))}
              />
            </label>
          </div>

          <div className="form-row">
            {form.category === 'core' ? (
              <label>
                Type
                <select value={form.type} onChange={e => setField('type', e.target.value)}>
                  <option value="">Select type…</option>
                  <option value="movement">Movement</option>
                  <option value="buff">Buff</option>
                </select>
              </label>
            ) : (
              <label>
                Type
                <input value={form.type} onChange={e => setField('type', e.target.value)} />
              </label>
            )}
            <label>
              Points
              <input
                type="number" min={0}
                value={form.points}
                onChange={e => setField('points', Number(e.target.value))}
              />
            </label>
          </div>

          <label>
            Attribute Range <span className="hint">(0 = self, up to 500ft)</span>
            <input
              value={form.attrRange ?? ''}
              onChange={e => setField('attrRange', e.target.value || undefined)}
              placeholder="e.g. 30ft"
            />
          </label>

          <fieldset className="attr-mod-fieldset">
            <legend>Stat Modifiers</legend>
            <div className="form-row">
              <label>
                Weight
                <input type="number" value={form.weight ?? ''} onChange={e => setField('weight', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
              <label>
                Dex Mod
                <input type="number" value={form.dexMod ?? ''} onChange={e => setField('dexMod', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
              <label>
                Str Mod
                <input type="number" value={form.strMod ?? ''} onChange={e => setField('strMod', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Rad Mod
                <input type="number" value={form.radMod ?? ''} onChange={e => setField('radMod', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
              <label>
                Con Mod
                <input type="number" value={form.conMod ?? ''} onChange={e => setField('conMod', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
              <label>
                AC Mod
                <input type="number" value={form.acMod ?? ''} onChange={e => setField('acMod', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Acro Mod
                <input type="number" value={form.acroMod ?? ''} onChange={e => setField('acroMod', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
              <label>
                Sig Mod
                <input type="number" value={form.sigMod ?? ''} onChange={e => setField('sigMod', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
              <label>
                Rend Mod
                <input type="number" value={form.rendMod ?? ''} onChange={e => setField('rendMod', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
            </div>
            <label>
              Movement
              <input type="number" value={form.movement ?? ''} onChange={e => setField('movement', e.target.value ? Number(e.target.value) : undefined)} />
            </label>
          </fieldset>

          {(form.category === 'utility' || form.category === 'weapon') && (
            <label>
              Action Type
              <select value={form.actionType ?? ''} onChange={e => setField('actionType', e.target.value)}>
                <option value="">Select action…</option>
                {ACTION_TYPES.map(at => (
                  <option key={at} value={at}>{at}</option>
                ))}
              </select>
            </label>
          )}

          {form.category === 'utility' && (
            <>
              <div className="form-row">
                <label>
                  Range
                  <input value={form.range ?? ''} onChange={e => setField('range', e.target.value)} />
                </label>
                <label>
                  Energy
                  <input
                    type="number" min={0}
                    value={form.energy ?? 0}
                    onChange={e => setField('energy', Number(e.target.value))}
                  />
                </label>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.oneTimeUse ?? false}
                  onChange={e => setField('oneTimeUse', e.target.checked || undefined)}
                />
                One-time Use
              </label>
            </>
          )}

          {form.category === 'weapon' && (
            <>
              <div className="form-row">
                <label>
                  Range
                  <input value={form.range ?? ''} onChange={e => setField('range', e.target.value)} />
                </label>
                <label>
                  Ammo Cost
                  <input
                    type="number" min={0}
                    value={form.ammoCost ?? 0}
                    onChange={e => setField('ammoCost', Number(e.target.value))}
                  />
                </label>
              </div>
              <label>
                Ammo Type
                <input value={form.ammoType ?? ''} onChange={e => setField('ammoType', e.target.value)} />
              </label>
              <label>
                Weapon Type
                <input value={form.weaponType ?? ''} onChange={e => setField('weaponType', e.target.value)} />
              </label>
              <label>
                Weapon Subtype
                <input value={form.weaponSubtype ?? ''} onChange={e => setField('weaponSubtype', e.target.value)} />
              </label>
            </>
          )}

          <div className="creator-form-actions">
            <button className="creator-btn creator-btn-save" onClick={handleSave}>
              {editingCustomIdx !== null ? 'Update' : isEditingPremade ? 'Save as Custom' : 'Add to Library'}
            </button>
            <button className="creator-btn creator-btn-clone" onClick={handleSaveAsNew}>
              Save As New
            </button>
            {editingCustomIdx !== null && (
              <button className="creator-btn creator-btn-delete" onClick={handleDelete}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
