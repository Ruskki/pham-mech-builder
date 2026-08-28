import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComponentNode, PremadeData, StoredBuild, ScaleType, ScaleModifiers, ArchetypeOption, ModelOption } from './types';
import { buildPremadeLib, compactTree, expandTree, mergePremades, premadeToComponent } from './types';
import { MechBuilder } from './pages/MechBuilder/MechBuilder';
import { ComponentCreator } from './pages/ComponentCreator/ComponentCreator';
import { CharacterSheet } from './pages/CharacterSheet/CharacterSheet';
import { Settings } from './pages/Settings/Settings';
import { DEFAULT_SCALE_MODIFIERS, DEFAULT_ARCHETYPES, DEFAULT_MODELS } from './data/defaults';
import './index.css';
import './App.css';

type Page = 'creator' | 'builder' | 'sheet' | 'settings';

const PAGES: { key: Page; label: string }[] = [
  { key: 'creator', label: 'Component Creator' },
  { key: 'builder', label: 'Mech Builder' },
  { key: 'sheet', label: 'Character Sheet' },
  { key: 'settings', label: 'Settings' },
];

interface UserData {
  premades: Record<string, PremadeData[]>;
  customComponents: PremadeData[];
  archetypes: ArchetypeOption[];
  models: ModelOption[];
  scales: Record<string, ScaleModifiers>;
  premadeEdits: Record<number, PremadeData>;
}

const EMPTY_DATA: UserData = {
  premades: { core: [], utility: [], weapon: [] },
  customComponents: [],
  archetypes: DEFAULT_ARCHETYPES,
  models: DEFAULT_MODELS,
  scales: { ...DEFAULT_SCALE_MODIFIERS },
  premadeEdits: {},
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveToAPI(data: UserData) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload: Record<string, unknown> = {
      ...data.premades,
      customComponents: data.customComponents,
      archetypes: data.archetypes,
      models: data.models,
      scales: data.scales,
      premadeEdits: data.premadeEdits,
    };
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(console.error);
  }, 300);
}

function parseData(raw: Record<string, unknown>): UserData {
  const premades: Record<string, PremadeData[]> = {};
  if (raw.core || raw.utility || raw.weapon) {
    premades.core = (raw.core as PremadeData[]) ?? [];
    premades.utility = (raw.utility as PremadeData[]) ?? [];
    premades.weapon = (raw.weapon as PremadeData[]) ?? [];
  } else if (raw.premadeComponents && typeof raw.premadeComponents === 'object') {
    const pc = raw.premadeComponents as Record<string, unknown>;
    premades.core = (pc.core as PremadeData[]) ?? [];
    premades.utility = (pc.utility as PremadeData[]) ?? [];
    premades.weapon = (pc.weapon as PremadeData[]) ?? [];
  } else {
    premades.core = [];
    premades.utility = [];
    premades.weapon = [];
  }
  return {
    premades,
    customComponents: (raw.customComponents as PremadeData[]) ?? [],
    archetypes: (raw.archetypes as ArchetypeOption[]) ?? DEFAULT_ARCHETYPES,
    models: (raw.models as ModelOption[]) ?? DEFAULT_MODELS,
    scales: (raw.scales as Record<string, ScaleModifiers>) ?? { ...DEFAULT_SCALE_MODIFIERS },
    premadeEdits: (raw.premadeEdits as Record<number, PremadeData>) ?? {},
  };
}

function loadMechFromStored(stored: StoredBuild, merged: Record<string, PremadeData[]>): ComponentNode | null {
  if (!stored.tree) return null;
  const baseLib = buildPremadeLib(merged);
  const lib: Record<number, ReturnType<typeof premadeToComponent>> = {};
  for (const [id, p] of Object.entries(baseLib)) {
    lib[Number(id)] = premadeToComponent(p as PremadeData);
  }
  for (const c of stored.customs ?? []) {
    if (c.id == null) continue;
    lib[c.id] = premadeToComponent(c);
  }
  return expandTree(stored.tree, lib);
}

function loadMech(merged: Record<string, PremadeData[]>, customs: PremadeData[]): ComponentNode | null {
  try {
    const raw = localStorage.getItem('pham-mech-builder-mech');
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (stored.id && stored.component) return stored as ComponentNode;
    if (!stored.tree) return null;
    return loadMechFromStored(stored, merged);
  } catch {
    localStorage.removeItem('pham-mech-builder-mech');
    return null;
  }
}

function saveMech(root: ComponentNode | null, allCustoms: PremadeData[]) {
  if (!root) {
    localStorage.removeItem('pham-mech-builder-mech');
    return;
  }
  const stored: StoredBuild = { customs: allCustoms, tree: compactTree(root) };
  localStorage.setItem('pham-mech-builder-mech', JSON.stringify(stored));
}

export function App() {
  const [page, setPage] = useState<Page>('builder');
  const [loaded, setLoaded] = useState(false);
  const [premades, setPremades] = useState<Record<string, PremadeData[]>>({ core: [], utility: [], weapon: [] });
  const [customComponents, setCustomComponents] = useState<PremadeData[]>([]);
  const [mechRoot, setMechRoot] = useState<ComponentNode | null>(null);
  const [scale, setScale] = useState<ScaleType>('HG');
  const [scaleMods, setScaleMods] = useState<Record<ScaleType, ScaleModifiers>>({ ...DEFAULT_SCALE_MODIFIERS });
  const [archetypes, setArchetypes] = useState<ArchetypeOption[]>(DEFAULT_ARCHETYPES);
  const [models, setModels] = useState<ModelOption[]>(DEFAULT_MODELS);
  const [premadeEdits, setPremadeEdits] = useState<Record<number, PremadeData>>({});
  const [maxPoints, setMaxPoints] = useState<number>(() => {
    try { return Number(localStorage.getItem('pham-mech-builder-max-points')) || 300; } catch { return 300; }
  });
  const [statMin, setStatMin] = useState<number>(() => {
    try { return Number(localStorage.getItem('pham-mech-builder-stat-min')) || 5; } catch { return 5; }
  });
  const [maxStatPoints, setMaxStatPoints] = useState<number>(() => {
    try { return Number(localStorage.getItem('pham-mech-builder-max-stat-points')) || 27; } catch { return 27; }
  });

  const dataRef = useRef<UserData>(EMPTY_DATA);

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then((raw: Record<string, unknown>) => {
        const data = parseData(raw);
        dataRef.current = data;
        setPremades(data.premades);
        setCustomComponents(data.customComponents);
        setScaleMods(data.scales);
        setArchetypes(data.archetypes);
        setModels(data.models);
        setPremadeEdits(data.premadeEdits);
        const merged = mergePremades(data.premades, data.premadeEdits);
        setMechRoot(loadMech(merged, data.customComponents));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    dataRef.current = {
      premades,
      customComponents,
      archetypes,
      models,
      scales: scaleMods,
      premadeEdits,
    };
    saveToAPI(dataRef.current);
  }, [premades, customComponents, archetypes, models, scaleMods, premadeEdits, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveMech(mechRoot, customComponents);
  }, [mechRoot, customComponents, loaded]);

  useEffect(() => {
    if (scaleMods[scale] === undefined) {
      setScale(Object.keys(scaleMods)[0] ?? 'HG');
    }
  }, [scaleMods, scale]);

  useEffect(() => {
    try { localStorage.setItem('pham-mech-builder-max-points', String(maxPoints)); } catch {}
  }, [maxPoints]);

  useEffect(() => {
    try { localStorage.setItem('pham-mech-builder-stat-min', String(statMin)); } catch {}
  }, [statMin]);

  useEffect(() => {
    try { localStorage.setItem('pham-mech-builder-max-stat-points', String(maxStatPoints)); } catch {}
  }, [maxStatPoints]);

  const updatePremadeEdit = useCallback((comp: PremadeData) => {
    setPremadeEdits(prev => ({ ...prev, [comp.id]: comp }));
  }, []);

  const removePremadeEdit = useCallback((id: number) => {
    setPremadeEdits(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const deletePremade = useCallback((cat: string, id: number) => {
    setPremades(prev => ({
      ...prev,
      [cat]: (prev[cat] ?? []).filter(c => c.id !== id),
    }));
    setPremadeEdits(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const mergedPremades = useMemo(
    () => mergePremades(premades, premadeEdits),
    [premades, premadeEdits],
  );

  const addCustom = useCallback((comp: PremadeData) => {
    setCustomComponents(prev => [...prev, comp]);
  }, []);

  const updateCustom = useCallback((index: number, comp: PremadeData) => {
    setCustomComponents(prev => {
      const next = [...prev];
      next[index] = comp;
      return next;
    });
  }, []);

  const removeCustom = useCallback((index: number) => {
    setCustomComponents(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDeleteAll = useCallback(() => {
    const blank: UserData = {
      premades: { core: [], utility: [], weapon: [] },
      customComponents: [],
      archetypes: [],
      models: [],
      scales: {},
      premadeEdits: {},
    };
    dataRef.current = blank;
    localStorage.removeItem('pham-mech-builder-mech');
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        core: [], utility: [], weapon: [],
        customComponents: [], archetypes: [],
        models: [], scales: {},
        premadeEdits: {},
      }),
    }).catch(console.error);
    setPremades({ core: [], utility: [], weapon: [] });
    setCustomComponents([]);
    setPremadeEdits({});
    setArchetypes([]);
    setModels([]);
    setScaleMods({});
    setMechRoot(null);
  }, []);

  const handleMassImport = useCallback((data: Record<string, unknown>) => {
    const parsed = parseData(data);
    dataRef.current = parsed;
    const payload: Record<string, unknown> = {
      ...parsed.premades,
      customComponents: parsed.customComponents,
      archetypes: parsed.archetypes,
      models: parsed.models,
      scales: parsed.scales,
      premadeEdits: parsed.premadeEdits,
    };
    console.log('Mass import payload:', Object.keys(payload), 'core:', (payload.core as unknown[])?.length, 'weapon:', (payload.weapon as unknown[])?.length);
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json()).then(d => console.log('Import saved:', d)).catch(err => console.error('Import save failed:', err));
    setPremades(parsed.premades);
    setCustomComponents(parsed.customComponents);
    setPremadeEdits(parsed.premadeEdits);
    setArchetypes(parsed.archetypes);
    setModels(parsed.models);
    setScaleMods(parsed.scales);
    setMechRoot(null);
    localStorage.removeItem('pham-mech-builder-mech');
  }, []);

  if (!loaded) {
    return (
      <div className="app-root">
        <div className="app-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#667788' }}>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <nav className="app-nav">
        <span className="app-logo">PHAM Mech Builder</span>
        <div className="app-tabs">
          {PAGES.map(p => (
            <button
              key={p.key}
              className={`app-tab ${page === p.key ? 'active' : ''}`}
              onClick={() => setPage(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          className="app-shutdown"
          title="Stop the server"
          onClick={() => {
            fetch('/api/shutdown', { method: 'POST' });
          }}
        >
          Shutdown
        </button>
      </nav>
      <div className="app-page">
        {page === 'creator' && (
          <ComponentCreator
            customComponents={customComponents}
            onAdd={addCustom}
            onUpdate={updateCustom}
            onRemove={removeCustom}
            premadeData={mergedPremades}
            rawPremades={premades}
            premadeEdits={premadeEdits}
            onUpdatePremadeEdit={updatePremadeEdit}
            onRemovePremadeEdit={removePremadeEdit}
            archetypes={archetypes}
            setArchetypes={setArchetypes}
            models={models}
            setModels={setModels}
            scaleMods={scaleMods}
            setScaleMods={setScaleMods}
            onDeleteAll={handleDeleteAll}
            onMassImport={handleMassImport}
            onDeletePremade={deletePremade}
          />
        )}
        {page === 'builder' && (
          <MechBuilder
            customComponents={customComponents}
            mechRoot={mechRoot}
            onMechRootChange={setMechRoot}
            scale={scale}
            setScale={setScale}
            scaleMods={scaleMods}
            setScaleMods={setScaleMods}
            archetypes={archetypes}
            models={models}
            premadeData={mergedPremades}
            maxPoints={maxPoints}
            statMin={statMin}
            maxStatPoints={maxStatPoints}
          />
        )}
        {page === 'sheet' && (
          <CharacterSheet mechRoot={mechRoot} scale={scale} scaleMods={scaleMods} />
        )}
        {page === 'settings' && (
          <Settings
            maxPoints={maxPoints}
            onMaxPointsChange={setMaxPoints}
            statMin={statMin}
            onStatMinChange={setStatMin}
            maxStatPoints={maxStatPoints}
            onMaxStatPointsChange={setMaxStatPoints}
          />
        )}
      </div>
    </div>
  );
}

export default App;
