import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ComponentNode, PremadeData, StoredBuild, ScaleType, ScaleModifiers, ArchetypeOption, ModelOption } from './types';
import { buildPremadeLib, compactTree, expandTree, mergePremades, premadeToComponent } from './types';
import { MechBuilder } from './pages/MechBuilder/MechBuilder';
import { ComponentCreator } from './pages/ComponentCreator/ComponentCreator';
import { CharacterSheet } from './pages/CharacterSheet/CharacterSheet';
import allComponents from './data/components.json';
import { DEFAULT_SCALE_MODIFIERS, DEFAULT_ARCHETYPES, DEFAULT_MODELS } from './data/defaults';
import './index.css';
import './App.css';

const CUSTOM_KEY = 'pham-mech-builder-custom';
const MECH_KEY = 'pham-mech-builder-mech';
const SCALES_KEY = 'pham-mech-builder-scales';
const ARCHETYPES_KEY = 'pham-mech-builder-archetypes';
const MODELS_KEY = 'pham-mech-builder-models';
const PREMADE_EDITS_KEY = 'pham-mech-builder-premade-edits';

type Page = 'creator' | 'builder' | 'sheet';

const PAGES: { key: Page; label: string }[] = [
  { key: 'creator', label: 'Component Creator' },
  { key: 'builder', label: 'Mech Builder' },
  { key: 'sheet', label: 'Character Sheet' },
];

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadPremadeEdits(): Record<number, PremadeData> {
  return loadJSON<Record<number, PremadeData>>(PREMADE_EDITS_KEY, {});
}

function loadMech(): ComponentNode | null {
  try {
    const stored = loadJSON<any>(MECH_KEY, null);
    if (!stored) return null;
    // Old format: bare ComponentNode tree stored directly
    if (stored.id && stored.component) return stored as ComponentNode;
    // New format: StoredBuild with tree + customs
    if (!stored.tree) return null;
    const merged = mergePremades(allComponents as Record<string, PremadeData[]>, loadPremadeEdits());
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
  } catch {
    localStorage.removeItem(MECH_KEY);
    return null;
  }
}

function saveMech(root: ComponentNode | null, allCustoms: PremadeData[]): void {
  if (!root) {
    localStorage.removeItem(MECH_KEY);
    return;
  }
  const stored: StoredBuild = { customs: allCustoms, tree: compactTree(root) };
  localStorage.setItem(MECH_KEY, JSON.stringify(stored));
}

export function App() {
  const [page, setPage] = useState<Page>('builder');
  const [customComponents, setCustomComponents] = useState<PremadeData[]>(() => loadJSON(CUSTOM_KEY, []));
  const [mechRoot, setMechRoot] = useState<ComponentNode | null>(() => loadMech());
  const [scale, setScale] = useState<ScaleType>('HG');
  const [scaleMods, setScaleMods] = useState<Record<ScaleType, ScaleModifiers>>(() => ({
    ...DEFAULT_SCALE_MODIFIERS,
    ...loadJSON<Record<string, ScaleModifiers>>(SCALES_KEY, {}),
  }));
  const [archetypes, setArchetypes] = useState<ArchetypeOption[]>(() => loadJSON(ARCHETYPES_KEY, DEFAULT_ARCHETYPES));
  const [models, setModels] = useState<ModelOption[]>(() => loadJSON(MODELS_KEY, DEFAULT_MODELS));
  const [premadeEdits, setPremadeEdits] = useState<Record<number, PremadeData>>(() => loadJSON(PREMADE_EDITS_KEY, {}));

  useEffect(() => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customComponents));
    saveMech(mechRoot, customComponents);
  }, [customComponents, mechRoot]);

  useEffect(() => {
    localStorage.setItem(SCALES_KEY, JSON.stringify(scaleMods));
  }, [scaleMods]);

  useEffect(() => {
    localStorage.setItem(ARCHETYPES_KEY, JSON.stringify(archetypes));
  }, [archetypes]);

  useEffect(() => {
    localStorage.setItem(MODELS_KEY, JSON.stringify(models));
  }, [models]);

  useEffect(() => {
    localStorage.setItem(PREMADE_EDITS_KEY, JSON.stringify(premadeEdits));
  }, [premadeEdits]);

  useEffect(() => {
    if (scaleMods[scale] === undefined) {
      setScale(Object.keys(scaleMods)[0] ?? 'HG');
    }
  }, [scaleMods, scale]);

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

  const mergedPremades = useMemo(
    () => mergePremades(allComponents as Record<string, PremadeData[]>, premadeEdits),
    [premadeEdits],
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
            premadeEdits={premadeEdits}
            onUpdatePremadeEdit={updatePremadeEdit}
            onRemovePremadeEdit={removePremadeEdit}
            archetypes={archetypes}
            setArchetypes={setArchetypes}
            models={models}
            setModels={setModels}
            scaleMods={scaleMods}
            setScaleMods={setScaleMods}
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
          />
        )}
        {page === 'sheet' && (
          <CharacterSheet mechRoot={mechRoot} scale={scale} scaleMods={scaleMods} />
        )}
      </div>
    </div>
  );
}

export default App;
