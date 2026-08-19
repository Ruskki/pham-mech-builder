import { useState, useCallback, useEffect } from 'react';
import type { ComponentNode, PremadeData, StoredBuild } from './types';
import { buildPremadeLib, compactTree, expandTree, premadeToComponent } from './types';
import { MechBuilder } from './pages/MechBuilder/MechBuilder';
import { ComponentCreator } from './pages/ComponentCreator/ComponentCreator';
import { CharacterSheet } from './pages/CharacterSheet/CharacterSheet';
import allComponents from './data/components.json';
import './index.css';
import './App.css';

const CUSTOM_KEY = 'pham-mech-builder-custom';
const MECH_KEY = 'pham-mech-builder-mech';

type Page = 'creator' | 'builder' | 'sheet';

const PAGES: { key: Page; label: string }[] = [
  { key: 'creator', label: 'Component Creator' },
  { key: 'builder', label: 'Mech Builder' },
  { key: 'sheet', label: 'Character Sheet' },
];

const premadeLib = buildPremadeLib(allComponents as Record<string, PremadeData[]>);
const premadeIds = new Set(Object.keys(premadeLib).map(Number));

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadMech(): ComponentNode | null {
  try {
    const stored = loadJSON<any>(MECH_KEY, null);
    if (!stored) return null;
    // Old format: bare ComponentNode tree stored directly
    if (stored.id && stored.component) return stored as ComponentNode;
    // New format: StoredBuild with tree + customs
    if (!stored.tree) return null;
    const lib: Record<number, ReturnType<typeof premadeToComponent>> = {};
    for (const [id, p] of Object.entries(premadeLib)) {
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

  useEffect(() => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customComponents));
    saveMech(mechRoot, customComponents);
  }, [customComponents, mechRoot]);

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
      </nav>
      <div className="app-page">
        {page === 'creator' && (
          <ComponentCreator
            customComponents={customComponents}
            onAdd={addCustom}
            onUpdate={updateCustom}
            onRemove={removeCustom}
          />
        )}
        {page === 'builder' && (
          <MechBuilder
            customComponents={customComponents}
            mechRoot={mechRoot}
            onMechRootChange={setMechRoot}
          />
        )}
        {page === 'sheet' && (
          <CharacterSheet mechRoot={mechRoot} />
        )}
      </div>
    </div>
  );
}

export default App;
