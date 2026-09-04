import { useState, useRef, useEffect, useMemo, type ChangeEvent } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PremadeData, ComponentCategory, ScaleModifiers, ArchetypeOption, ModelOption, LocalizedEntry, LocalizedArchetype } from '../../types';
import { defaultPremade, normalizeStr, localizedName, localizedArchetypeLabel } from '../../types';
import { useLang, LANGUAGES } from '../../i18n';
import { SCALES, MOD_KEYS, MOD_LABELS, DEFAULT_ARCHETYPES, DEFAULT_MODELS, DEFAULT_SCALE_MODIFIERS } from '../../data/defaults';
import './ComponentCreator.css';

interface ComponentCreatorProps {
  customComponents: PremadeData[];
  onAdd: (comp: PremadeData) => void;
  onUpdate: (index: number, comp: PremadeData) => void;
  onRemove: (index: number) => void;
  premadeData: Record<string, PremadeData[]>;
  onUpdatePremade: (cat: string, comp: PremadeData) => void;
  archetypes: ArchetypeOption[];
  setArchetypes: Dispatch<SetStateAction<ArchetypeOption[]>>;
  models: ModelOption[];
  setModels: Dispatch<SetStateAction<ModelOption[]>>;
  scaleMods: Record<string, ScaleModifiers>;
  setScaleMods: (mods: Record<string, ScaleModifiers>) => void;
  onDeleteAll: () => void;
  onMassImport: (data: Record<string, unknown>) => void;
  onDeletePremade: (cat: string, id: number) => void;
}

const CATEGORIES: ComponentCategory[] = ['core', 'utility', 'weapon'];
const CAT_COLORS: Record<string, string> = { core: '#4fc3f7', utility: '#81c784', weapon: '#ef5350' };
const ACTION_TYPES = ['action', 'bonus', 'reaction'];

type Tab = 'components' | 'archetypes' | 'scales' | 'models';

interface LibraryEntry {
  data: PremadeData;
  kind: 'premade' | 'custom';
  customIdx?: number;
  group: ComponentCategory;
}

function findPremadeById(data: Record<string, PremadeData[]>, id: number): PremadeData | undefined {
  for (const comps of Object.values(data)) {
    for (const c of comps ?? []) {
      if (c.id === id) return c;
    }
  }
  return undefined;
}

function numOrEmpty(n?: number): string {
  return n === undefined || n === null ? '' : String(n);
}

export function ComponentCreator({
  customComponents,
  onAdd,
  onUpdate,
  onRemove,
  premadeData,
  onUpdatePremade,
  archetypes,
  setArchetypes,
  models,
  setModels,
  scaleMods,
  setScaleMods,
  onDeleteAll,
  onMassImport,
  onDeletePremade,
}: ComponentCreatorProps) {
  const [tab, setTab] = useState<Tab>('components');
  const [search, setSearch] = useState('');
  const [editingCustomIdx, setEditingCustomIdx] = useState<number | null>(null);
  const [form, setForm] = useState<PremadeData>(defaultPremade('core'));

  const [archetypeForm, setArchetypeForm] = useState<ArchetypeOption>({ languages: {}, cost: 0 });
  const [editingArchetypeIdx, setEditingArchetypeIdx] = useState<number | null>(null);

  const [modelForm, setModelForm] = useState<ModelOption>({ name: '', scales: [] });
  const [editingModelIdx, setEditingModelIdx] = useState<number | null>(null);

  const [selectedScale, setSelectedScale] = useState<string | null>(null);
  const [scaleNameInput, setScaleNameInput] = useState('');
  const [scaleForm, setScaleForm] = useState<ScaleModifiers>({});

  const importRef = useRef<HTMLInputElement>(null);
  const massImportRef = useRef<HTMLInputElement>(null);
  const { lang } = useLang();

  useEffect(() => {
    if (tab !== 'components') {
      setSearch('');
    }
  }, [tab]);

  const prevPremadeDataRef = useRef(premadeData);
  const prevFormIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (editingCustomIdx !== null || form.id <= 0) {
      prevPremadeDataRef.current = premadeData;
      prevFormIdRef.current = form.id;
      return;
    }
    const selectedNew = form.id !== prevFormIdRef.current;
    const dataChanged = premadeData !== prevPremadeDataRef.current;
    prevPremadeDataRef.current = premadeData;
    prevFormIdRef.current = form.id;
    if (!selectedNew && !dataChanged) return;
    const base = findPremadeById(premadeData, form.id);
    if (base) setForm({ ...base });
  }, [form.id, editingCustomIdx, premadeData]);

  function setField<K extends keyof PremadeData>(key: K, value: PremadeData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function nextId(): number {
    let max = 0;
    for (const cat of CATEGORIES) {
      for (const c of (premadeData[cat] ?? [])) {
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
      (premadeData[cat] ?? []).map(c => ({ data: { ...c, category: cat }, kind: 'premade' as const, group: cat })),
    ),
    ...customComponents.map((c, i) => ({
      data: c, kind: 'custom' as const, customIdx: i, group: c.category,
    })),
  ];

  const filtered = search
    ? allEntries.filter(e => normalizeStr(localizedName(e.data, lang)).includes(normalizeStr(search)))
    : allEntries;

  const grouped = CATEGORIES.map(cat => ({
    category: cat,
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    color: CAT_COLORS[cat] ?? '#888',
    entries: filtered.filter(e => e.group === cat),
  })).filter(g => g.entries.length > 0);

  function select(entry: LibraryEntry) {
    if (entry.kind === 'custom' && entry.customIdx !== undefined) {
      setEditingCustomIdx(entry.customIdx);
    } else {
      setEditingCustomIdx(null);
    }
    setForm({ ...entry.data });
  }

  const isEditingPremade = editingCustomIdx === null && form.id > 0;

  function handleNew() {
    setEditingCustomIdx(null);
    setForm(defaultPremade('core'));
  }

  function handleSave() {
    if (editingCustomIdx !== null) {
      onUpdate(editingCustomIdx, form);
    } else if (form.id > 0) {
      onUpdatePremade(form.category, form);
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

  function handleImport(e: ChangeEvent<HTMLInputElement>) {
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

  function handleMassImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data && typeof data === 'object') {
          const hasRaw = 'core' in data || 'utility' in data || 'weapon' in data;
          if (hasRaw || 'premadeComponents' in data) {
            console.log('Importing data:', Object.keys(data));
            onMassImport(data);
            setEditingCustomIdx(null);
            setForm(defaultPremade('core'));
            setEditingArchetypeIdx(null);
            setArchetypeForm({ languages: {}, cost: 0 });
            setEditingModelIdx(null);
            setModelForm({ name: '', scales: [] });
            setSelectedScale(null);
            setScaleNameInput('');
            setScaleForm({});
          } else {
            console.error('Unrecognised import format:', Object.keys(data));
          }
        } else {
          console.error('Import file is not an object');
        }
      } catch (err) {
        console.error('Import parse error:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleMassExport() {
    const categorized: Record<string, PremadeData[]> = {};
    for (const [cat, comps] of Object.entries(premadeData)) {
      categorized[cat] = (comps ?? []).map(c => ({ ...c, category: cat as ComponentCategory }));
    }
    const data = {
      ...categorized,
      customComponents: customComponents.map(c => ({ ...c })),
      archetypes,
      models,
      scales: scaleMods,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pham-library-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDeleteAll() {
    if (!confirm('Delete ALL custom components, archetypes, scales, models, and premade edits? This cannot be undone.')) return;
    onDeleteAll();
    setEditingCustomIdx(null);
    setForm(defaultPremade('core'));
    setEditingArchetypeIdx(null);
    setArchetypeForm({ languages: {}, cost: 0 });
    setEditingModelIdx(null);
    setModelForm({ name: '', scales: [] });
    setSelectedScale(null);
    setScaleNameInput('');
    setScaleForm({});
  }

  const orderedScales = useMemo(
    () =>
      [...SCALES, ...Object.keys(scaleMods).filter(s => !(SCALES as readonly string[]).includes(s))].filter(s => scaleMods[s] !== undefined),
    [scaleMods],
  );

  function selectArchetype(idx: number) {
    const a = archetypes[idx];
    if (!a) return;
    setEditingArchetypeIdx(idx);
    setArchetypeForm({ ...a });
  }

  function handleArchetypeNew() {
    setEditingArchetypeIdx(null);
    setArchetypeForm({ languages: {}, cost: 0 });
  }

  function handleArchetypeSave() {
    const label = archetypeForm.languages?.[lang]?.label?.trim() ?? '';
    if (!label) return;
    const dup = archetypes.some((a, i) => localizedArchetypeLabel(a, lang) === label && i !== editingArchetypeIdx);
    if (dup) return;
    if (editingArchetypeIdx !== null) {
      setArchetypes(prev => {
        const next = [...prev];
        const existing = next[editingArchetypeIdx];
        const langCopy = { ...(existing?.languages ?? {}) };
        langCopy[lang] = { label };
        next[editingArchetypeIdx] = { ...archetypeForm, languages: langCopy };
        return next;
      });
    } else {
      setArchetypes(prev => [...prev, { ...archetypeForm, languages: { ...(archetypeForm.languages ?? {}), [lang]: { label } } }]);
    }
  }

  function handleArchetypeDelete() {
    if (editingArchetypeIdx === null) return;
    setArchetypes(prev => prev.filter((_, i) => i !== editingArchetypeIdx));
    handleArchetypeNew();
  }

  function selectScale(name: string) {
    setSelectedScale(name);
    setScaleNameInput(name);
    setScaleForm({ ...(scaleMods[name] ?? {}) });
  }

  function handleScaleNew() {
    const name = `Scale ${orderedScales.length + 1}`;
    setSelectedScale(name);
    setScaleNameInput(name);
    setScaleForm({});
  }

  function handleScaleSave() {
    const name = scaleNameInput.trim();
    if (!name) return;
    const next = { ...scaleMods };
    if (selectedScale && selectedScale !== name) {
      delete next[selectedScale];
    }
    next[name] = scaleForm;
    setScaleMods(next);
    setSelectedScale(name);
  }

  function handleScaleDelete() {
    if (!selectedScale) return;
    const next = { ...scaleMods };
    delete next[selectedScale];
    setScaleMods(next);
    setSelectedScale(null);
    setScaleNameInput('');
    setScaleForm({});
  }

  function setScaleModField(key: keyof ScaleModifiers, value: number | undefined) {
    setScaleForm(prev => ({ ...prev, [key]: value }));
  }

  function selectModel(idx: number) {
    const m = models[idx];
    if (!m) return;
    setEditingModelIdx(idx);
    setModelForm({ name: m.name, scales: [...m.scales] });
  }

  function handleModelNew() {
    setEditingModelIdx(null);
    setModelForm({ name: '', scales: [] });
  }

  function toggleModelScale(scaleName: string) {
    setModelForm(prev => ({
      ...prev,
      scales: prev.scales.includes(scaleName)
        ? prev.scales.filter(s => s !== scaleName)
        : [...prev.scales, scaleName],
    }));
  }

  function handleModelSave() {
    const name = modelForm.name.trim();
    if (!name) return;
    const dup = models.some((m, i) => m.name === name && i !== editingModelIdx);
    if (dup) return;
    const entry = { ...modelForm, name };
    if (editingModelIdx !== null) {
      setModels(prev => {
        const next = [...prev];
        next[editingModelIdx] = entry;
        return next;
      });
    } else {
      setModels(prev => [...prev, entry]);
    }
  }

  function handleModelDelete() {
    if (editingModelIdx === null) return;
    setModels(prev => prev.filter((_, i) => i !== editingModelIdx));
    handleModelNew();
  }

  function onTabChange(next: Tab) {
    setTab(next);
    setSearch('');
    setEditingCustomIdx(null);
    setForm(defaultPremade('core'));
    setEditingModelIdx(null);
    setModelForm({ name: '', scales: [] });
  }

  return (
    <div className="creator-content">
      <div className="creator-tabs-bar">
        <button
          className={`creator-tab ${tab === 'components' ? 'active' : ''}`}
          onClick={() => onTabChange('components')}
        >
          Components
        </button>
        <button
          className={`creator-tab ${tab === 'archetypes' ? 'active' : ''}`}
          onClick={() => onTabChange('archetypes')}
        >
          Archetypes
        </button>
        <button
          className={`creator-tab ${tab === 'scales' ? 'active' : ''}`}
          onClick={() => onTabChange('scales')}
        >
          Scales
        </button>
        <button
          className={`creator-tab ${tab === 'models' ? 'active' : ''}`}
          onClick={() => onTabChange('models')}
        >
          Models
        </button>
      </div>
      <div className='creator-page'>
        
      
        <aside className="creator-library">
          <div className="creator-lib-header">
            <h3>{tab === 'components' ? 'Library' : tab === 'archetypes' ? 'Archetypes' : tab === 'models' ? 'Models' : 'Scales'}</h3>
            <input
              className="creator-search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="creator-lib-list">
            {tab === 'components' && (
              <>
                {grouped.map(g => (
                  <div key={g.category}>
                    <div className="creator-lib-group" style={{ color: g.color }}>
                      {g.label}
                    </div>
                    {g.entries.map((entry, i) => {
                      const sel =
                        entry.kind === 'custom'
                          ? editingCustomIdx === entry.customIdx
                           : editingCustomIdx === null && localizedName(form, lang) === localizedName(entry.data, lang) && form.category === entry.data.category;
                      return (
                        <button
                           key={`${entry.kind}-${localizedName(entry.data, lang)}-${i}`}
                          className={`creator-lib-item ${sel ? 'sel' : ''}`}
                          onClick={() => select(entry)}
                        >
                          <span className="creator-lib-name">{localizedName(entry.data, lang)}</span>
                          <span className={`creator-lib-pts ${entry.data.points > 0 ? '' : 'zero'}`}>{entry.data.points}p</span>
                          {entry.kind === 'custom' && <span className="creator-lib-badge">custom</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="creator-lib-empty">No components</div>
                )}
              </>
            )}
            {tab === 'archetypes' && (
              <>
                 {archetypes
                   .filter(a => !search || normalizeStr(localizedArchetypeLabel(a, lang)).includes(normalizeStr(search)))
                   .map((a, i) => (
                     <button
                       key={localizedArchetypeLabel(a, lang)}
                       className={`creator-lib-item ${editingArchetypeIdx === i ? 'sel' : ''}`}
                       onClick={() => selectArchetype(i)}
                     >
                       <span className="creator-lib-name">{localizedArchetypeLabel(a, lang)}</span>
                       <span className="creator-lib-badge">{a.cost}p</span>
                     </button>
                   ))}
                 {archetypes.filter(a => !search || normalizeStr(localizedArchetypeLabel(a, lang)).includes(normalizeStr(search))).length === 0 && (
                  <div className="creator-lib-empty">No archetypes</div>
                )}
              </>
            )}
            {tab === 'models' && (
              <>
                {models
                  .map((m, i) => ({ m, i }))
                  .filter(({ m }) => !search || normalizeStr(m.name).includes(normalizeStr(search)))
                  .map(({ m, i }) => (
                    <button
                      key={m.name}
                      className={`creator-lib-item ${editingModelIdx === i ? 'sel' : ''}`}
                      onClick={() => selectModel(i)}
                    >
                      <span className="creator-lib-name">{m.name}</span>
                      <span className="creator-lib-scales">{m.scales.join(' / ') || 'no scales'}</span>
                    </button>
                  ))}
                {models.filter(m => !search || normalizeStr(m.name).includes(normalizeStr(search))).length === 0 && (
                  <div className="creator-lib-empty">No models</div>
                )}
              </>
            )}
            {tab === 'scales' && (
              <>
                {orderedScales
                  .filter(s => !search || normalizeStr(s).includes(normalizeStr(search)))
                  .map(s => (
                    <button
                      key={s}
                      className={`creator-lib-item ${selectedScale === s ? 'sel' : ''}`}
                      onClick={() => selectScale(s)}
                    >
                      <span className="creator-lib-name">{s}</span>
                    </button>
                  ))}
                {orderedScales.filter(s => !search || normalizeStr(s).includes(normalizeStr(search))).length === 0 && (
                  <div className="creator-lib-empty">No scales</div>
                )}
              </>
            )}
          </div>
        </aside>

        <div className="creator-editor">
          <div className="creator-editor-header">
            <h3>
              {tab === 'components'
                ? isEditingPremade
                  ? 'Edit Base Component'
                  : editingCustomIdx !== null
                    ? 'Edit Custom Component'
                    : 'New Component'
                : tab === 'archetypes'
                  ? editingArchetypeIdx !== null
                    ? 'Edit Archetype'
                    : 'New Archetype'
                  : tab === 'models'
                    ? editingModelIdx !== null
                      ? 'Edit Model'
                      : 'New Model'
                    : 'Scales'}
            </h3>
            <div className="creator-editor-actions">
              <button className="creator-btn creator-btn-mass" onClick={handleMassExport}>
                Mass Export
              </button>
              <input ref={massImportRef} type="file" accept=".json" onChange={handleMassImport} hidden />
              <button className="creator-btn creator-btn-mass" onClick={() => massImportRef.current?.click()}>
                Mass Import
              </button>
              <button className="creator-btn creator-btn-delete-all" onClick={handleDeleteAll}>
                Delete All
              </button>
              {tab === 'components' && (
                <>
                  <input ref={importRef} type="file" accept=".json" onChange={handleImport} hidden />
                  <button className="creator-btn creator-btn-io" onClick={() => importRef.current?.click()}>
                    Import
                  </button>
                  <button className="creator-btn creator-btn-new" onClick={handleNew}>
                    + New
                  </button>
                </>
              )}
              {tab === 'archetypes' && (
                <button className="creator-btn creator-btn-new" onClick={handleArchetypeNew}>
                  + New
                </button>
              )}
              {tab === 'models' && (
                <button className="creator-btn creator-btn-new" onClick={handleModelNew}>
                  + New
                </button>
              )}
              {tab === 'scales' && (
                <button className="creator-btn creator-btn-new" onClick={handleScaleNew}>
                  + New Scale
                </button>
              )}
            </div>
          </div>

          {tab === 'components' && (
            <div className="creator-form">
              <div className="category-tabs">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`cat-tab ${form.category === cat ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, category: cat }))}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

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
                <label>
                  Max Count
                  <input
                    type="number" min={0} placeholder="0 = unlimited"
                    value={form.maxCount ?? ''}
                    onChange={e => setField('maxCount', e.target.value ? Number(e.target.value) : undefined)}
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
                <legend>Translations</legend>
                {LANGUAGES.map(lc => (
                  <div key={lc.code} className="form-row">
                    <label style={{ flex: 1 }}>
                      {lc.label} Name
                      <input
                        value={form.languages?.[lc.code]?.name ?? ''}
                        onChange={e => {
                          const prev = { ...form.languages } as LocalizedEntry | undefined;
                          const entry = prev?.[lc.code] ?? { name: '', description: '' };
                          const updated = { ...entry, name: e.target.value };
                          const next = { ...(prev ?? {}), [lc.code]: updated };
                          setField('languages', next);
                        }}
                      />
                    </label>
                  </div>
                ))}
                {LANGUAGES.map(lc => (
                  <div key={lc.code + '-desc'}>
                    <label>
                      {lc.label} Description
                      <textarea
                        rows={2}
                        value={form.languages?.[lc.code]?.description ?? ''}
                        onChange={e => {
                          const prev = { ...form.languages } as LocalizedEntry | undefined;
                          const entry = prev?.[lc.code] ?? { name: '', description: '' };
                          const updated = { ...entry, description: e.target.value };
                          const next = { ...(prev ?? {}), [lc.code]: updated };
                          setField('languages', next);
                        }}
                      />
                    </label>
                  </div>
                ))}
              </fieldset>

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
                  {editingCustomIdx !== null ? 'Update' : isEditingPremade ? 'Save Edit' : 'Add to Library'}
                </button>
                <button className="creator-btn creator-btn-clone" onClick={handleSaveAsNew}>
                  Save As New
                </button>
                {isEditingPremade && (
                  <button
                    className="creator-btn creator-btn-delete"
                    onClick={() => {
                      if (confirm('Delete this component permanently?')) {
                        onDeletePremade(form.category, form.id);
                        setEditingCustomIdx(null);
                        setForm(defaultPremade('core'));
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
                {editingCustomIdx !== null && (
                  <button className="creator-btn creator-btn-delete" onClick={handleDelete}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'archetypes' && (
            <div className="creator-form">
              {editingArchetypeIdx !== null && (
                <div className="panel-stat-row" style={{ fontSize: '0.75rem', color: '#667788' }}>
                  Editing: {localizedArchetypeLabel(archetypes[editingArchetypeIdx] ?? { languages: {} }, lang)}
                </div>
              )}
              <div className="form-row">
                <label>
                  Label
                  <input
                    value={archetypeForm.languages?.[lang]?.label ?? ''}
                    onChange={e => setArchetypeForm(prev => ({ ...prev, languages: { ...(prev.languages ?? {}), [lang]: { label: e.target.value } } }))}
                    placeholder="e.g. Brute"
                  />
                </label>
                <label>
                  Cost
                  <input
                    type="number" min={0}
                    value={archetypeForm.cost}
                    onChange={e => setArchetypeForm(prev => ({ ...prev, cost: Number(e.target.value) }))}
                  />
                </label>
              </div>
              <fieldset className="attr-mod-fieldset">
                <legend>Translations</legend>
                {LANGUAGES.map(lc => (
                  <div key={lc.code} className="form-row">
                    <label style={{ flex: 1 }}>
                      {lc.label} Label
                      <input
                        value={archetypeForm.languages?.[lc.code]?.label ?? ''}
                        onChange={e => {
                          const prev = { ...archetypeForm.languages } as LocalizedArchetype | undefined;
                          const updated = { label: e.target.value };
                          const next = { ...(prev ?? {}), [lc.code]: updated };
                          setArchetypeForm(prev => ({ ...prev, languages: next }));
                        }}
                      />
                    </label>
                  </div>
                ))}
              </fieldset>
              <div className="creator-form-actions">
                <button className="creator-btn creator-btn-save" onClick={handleArchetypeSave}>
                  {editingArchetypeIdx !== null ? 'Update' : 'Add Archetype'}
                </button>
                <button className="creator-btn creator-btn-clone" onClick={handleArchetypeNew}>
                  + New
                </button>
                {editingArchetypeIdx !== null && (
                  <button className="creator-btn creator-btn-delete" onClick={handleArchetypeDelete}>
                    Delete
                  </button>
                )}
              </div>
              <div className="panel-stat-row" style={{ fontSize: '0.72rem', color: '#667788', marginTop: '0.5rem' }}>
                Total archetype cost: {archetypes.reduce((s, a) => s + a.cost, 0)}p · {archetypes.length} archetypes
              </div>
            </div>
          )}

          {tab === 'models' && (
            <div className="creator-form">
              {editingModelIdx !== null && (
                <div className="panel-stat-row" style={{ fontSize: '0.75rem', color: '#667788' }}>
                  Editing: {models[editingModelIdx]?.name || ''}
                </div>
              )}
              <label>
                Model Name
                <input
                  value={modelForm.name}
                  onChange={e => setModelForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Prototype"
                />
              </label>

              <fieldset className="attr-mod-fieldset">
                <legend>Compatible Scales</legend>
                <div className="model-scale-grid">
                  {orderedScales.map(s => (
                    <label key={s} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={modelForm.scales.includes(s)}
                        onChange={() => toggleModelScale(s)}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="creator-form-actions">
                <button className="creator-btn creator-btn-save" onClick={handleModelSave}>
                  {editingModelIdx !== null ? 'Update' : 'Add Model'}
                </button>
                <button className="creator-btn creator-btn-clone" onClick={handleModelNew}>
                  + New
                </button>
                {editingModelIdx !== null && (
                  <button className="creator-btn creator-btn-delete" onClick={handleModelDelete}>
                    Delete
                  </button>
                )}
              </div>
              <div className="panel-stat-row" style={{ fontSize: '0.72rem', color: '#667788', marginTop: '0.5rem' }}>
                {models.length} models · models with no compatible scales are hidden in the builder
              </div>
            </div>
          )}

          {tab === 'scales' && (
            <div className="creator-form">
              {selectedScale ? (
                <>
                  <label>
                    Scale Name
                    <input
                      value={scaleNameInput}
                      onChange={e => setScaleNameInput(e.target.value)}
                      placeholder="e.g. PG"
                    />
                  </label>

                  <fieldset className="attr-mod-fieldset">
                    <legend>Modifiers</legend>
                    {MOD_KEYS.map(key => (
                      <div className="form-row" key={key}>
                        <label style={{ flex: 1 }}>
                          {MOD_LABELS[key]}
                          <input
                            type="number"
                            value={numOrEmpty(scaleForm[key] as number | undefined)}
                            onChange={e => setScaleModField(key, e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </label>
                      </div>
                    ))}
                  </fieldset>

                  <div className="creator-form-actions">
                    <button className="creator-btn creator-btn-save" onClick={handleScaleSave}>
                      Save Scale
                    </button>
                    <button className="creator-btn creator-btn-clone" onClick={handleScaleNew}>
                      + New Scale
                    </button>
                    <button className="creator-btn creator-btn-delete" onClick={handleScaleDelete}>
                      Delete Scale
                    </button>
                  </div>
                </>
              ) : (
                <div className="creator-lib-empty">Select or create a scale.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
