import { useState, useCallback, useEffect, useRef } from 'react';
import type { ComponentNode, PremadeData, StoredBuild, ScaleType, ScaleModifiers, ArchetypeOption, ModelOption } from './types';
import { compactTree, expandTree, premadeToComponent, buildPremadeLib } from './types';
import { MechBuilder } from './pages/MechBuilder/MechBuilder';
import { ComponentCreator } from './pages/ComponentCreator/ComponentCreator';
import { CharacterSheet } from './pages/CharacterSheet/CharacterSheet';
import { Settings } from './pages/Settings/Settings';
import { DEFAULT_SCALE_MODIFIERS, DEFAULT_ARCHETYPES, DEFAULT_MODELS } from './data/defaults';
import { LanguageProvider, useLang, LANGUAGES } from './i18n';
import defaultComponentsData from './data/components.json';
import './index.css';
import './App.css';

const IS_SERVER = typeof process !== 'undefined' && process.env?.BUILD_TARGET === 'server';

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
}

const EMPTY_DATA: UserData = {
  premades: { core: [], utility: [], weapon: [] },
  customComponents: [],
  archetypes: DEFAULT_ARCHETYPES,
  models: DEFAULT_MODELS,
  scales: { ...DEFAULT_SCALE_MODIFIERS },
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

const STORAGE_KEY = 'pham-mech-builder-data';

function saveData(data: UserData) {
  if (IS_SERVER) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const payload: Record<string, unknown> = {
        ...data.premades,
        customComponents: data.customComponents,
        archetypes: data.archetypes,
        models: data.models,
        scales: data.scales,
      };
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(console.error);
    }, 300);
  } else {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        premades: data.premades,
        customComponents: data.customComponents,
        archetypes: data.archetypes,
        models: data.models,
        scales: data.scales,
      }));
    } catch {}
  }
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
  const edits = (raw.premadeEdits as Record<number, PremadeData>) ?? {};
  for (const [idStr, edit] of Object.entries(edits)) {
    const id = Number(idStr);
    for (const cat of ['core', 'utility', 'weapon']) {
      const comps = premades[cat] ?? [];
      const idx = comps.findIndex(c => c.id === id);
      if (idx >= 0) {
        comps[idx] = { ...comps[idx], ...edit };
        break;
      }
    }
  }
  return {
    premades,
    customComponents: (raw.customComponents as PremadeData[]) ?? [],
    archetypes: (raw.archetypes as ArchetypeOption[]) ?? DEFAULT_ARCHETYPES,
    models: (raw.models as ModelOption[]) ?? DEFAULT_MODELS,
    scales: (raw.scales as Record<string, ScaleModifiers>) ?? { ...DEFAULT_SCALE_MODIFIERS },
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

function loadMech(premades: Record<string, PremadeData[]>, customs: PremadeData[]): ComponentNode | null {
  try {
    const raw = localStorage.getItem('pham-mech-builder-mech');
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (stored.id && stored.component) return stored as ComponentNode;
    if (!stored.tree) return null;
    return loadMechFromStored(stored, premades);
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
  const [scale, setScaleState] = useState<ScaleType>(() => {
    try { return (localStorage.getItem('pham-mech-builder-scale') as ScaleType) || 'HG'; } catch { return 'HG'; }
  });
  const [scaleMods, setScaleMods] = useState<Record<ScaleType, ScaleModifiers>>({ ...DEFAULT_SCALE_MODIFIERS });
  const [archetypes, setArchetypes] = useState<ArchetypeOption[]>(DEFAULT_ARCHETYPES);
  const [models, setModels] = useState<ModelOption[]>(DEFAULT_MODELS);
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
    if (IS_SERVER) {
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
          setMechRoot(loadMech(data.premades, data.customComponents));
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      const raw = saved ? { ...defaultComponentsData, ...JSON.parse(saved) } : defaultComponentsData as Record<string, unknown>;
      const data = parseData(raw);
      dataRef.current = data;
      setPremades(data.premades);
      setCustomComponents(data.customComponents);
      setScaleMods(data.scales);
      setArchetypes(data.archetypes);
      setModels(data.models);
      setMechRoot(loadMech(data.premades, data.customComponents));
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    dataRef.current = {
      premades,
      customComponents,
      archetypes,
      models,
      scales: scaleMods,
    };
    saveData(dataRef.current);
  }, [premades, customComponents, archetypes, models, scaleMods, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveMech(mechRoot, customComponents);
  }, [mechRoot, customComponents, loaded]);

  useEffect(() => {
    try { localStorage.setItem('pham-mech-builder-scale', scale); } catch {}
  }, [scale]);

  const setScale = useCallback((s: ScaleType) => {
    setScaleState(s);
  }, []);

  useEffect(() => {
    if (scaleMods[scale] === undefined) {
      setScaleState(Object.keys(scaleMods)[0] as ScaleType ?? 'HG');
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

  const updatePremade = useCallback((cat: string, comp: PremadeData) => {
    setPremades(prev => {
      const comps = prev[cat] ?? [];
      const idx = comps.findIndex(c => c.id === comp.id);
      if (idx < 0) return prev;
      const next = [...comps];
      next[idx] = comp;
      return { ...prev, [cat]: next };
    });
  }, []);

  const deletePremade = useCallback((cat: string, id: number) => {
    setPremades(prev => ({
      ...prev,
      [cat]: (prev[cat] ?? []).filter(c => c.id !== id),
    }));
  }, []);

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
    };
    dataRef.current = blank;
    localStorage.removeItem('pham-mech-builder-mech');
    if (IS_SERVER) {
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          core: [], utility: [], weapon: [],
          customComponents: [], archetypes: [],
          models: [], scales: {},
        }),
      }).catch(console.error);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setPremades({ core: [], utility: [], weapon: [] });
    setCustomComponents([]);
    setArchetypes([]);
    setModels([]);
    setScaleMods({});
    setMechRoot(null);
  }, []);

  const handleMassImport = useCallback((data: Record<string, unknown>) => {
    const parsed = parseData(data);
    dataRef.current = parsed;
    if (IS_SERVER) {
      const payload: Record<string, unknown> = {
        ...parsed.premades,
        customComponents: parsed.customComponents,
        archetypes: parsed.archetypes,
        models: parsed.models,
        scales: parsed.scales,
      };
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json()).then(d => console.log('Import saved:', d)).catch(err => console.error('Import save failed:', err));
    }
    setPremades(parsed.premades);
    setCustomComponents(parsed.customComponents);
    setArchetypes(parsed.archetypes);
    setModels(parsed.models);
    setScaleMods(parsed.scales);
    setMechRoot(null);
    localStorage.removeItem('pham-mech-builder-mech');
  }, []);

  if (!loaded) {
    return (
      <LanguageProvider>
        <div className="app-root">
          <div className="app-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#667788' }}>Loading…</span>
          </div>
        </div>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
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
          <LangToggle />
          {IS_SERVER && (
            <button
              className="app-shutdown"
              title="Stop the server"
              onClick={() => {
                fetch('/api/shutdown', { method: 'POST' }).then(() => {
                  setTimeout(() => window.location.reload(), 500);
                });
              }}
            >
              Shutdown
            </button>
          )}
        </nav>
      <div className="app-page">
        {page === 'creator' && (
          <ComponentCreator
            customComponents={customComponents}
            onAdd={addCustom}
            onUpdate={updateCustom}
            onRemove={removeCustom}
            premadeData={premades}
            onUpdatePremade={updatePremade}
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
            premadeData={premades}
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
    </LanguageProvider>
  );
}

function LangToggle() {
  const { lang, setLang } = useLang();
  const currentIdx = LANGUAGES.findIndex(l => l.code === lang);
  const nextIdx = (currentIdx + 1) % LANGUAGES.length;
  const nextLang = LANGUAGES[nextIdx];

  return (
    <button
      className="lang-toggle"
      title={nextLang ? `Switch to ${nextLang.label}` : undefined}
      onClick={() => { if (nextLang) setLang(nextLang.code); }}
    >
      {lang.toUpperCase()}
    </button>
  );
}

export default App;
