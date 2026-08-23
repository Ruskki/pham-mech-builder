import { useState, useCallback, useRef, useMemo } from 'react';
import type { MechComponent, ComponentNode, PremadeData, StoredBuild, ScaleType, ScaleModifiers } from '../../types';
import { createNode, addToSlot, removeById, buildPremadeLib, expandTree, compactTree, collectCustomIds, premadeToComponent } from '../../types';
import { SidePanel } from './SidePanel';
import { MechTree, RootSlot } from './MechTree';
import { GraphView } from './GraphView';
import { ComponentPicker } from './ComponentPicker';
import allComponents from '../../data/components.json';
import './MechBuilder.css';

interface MechBuilderProps {
  customComponents: PremadeData[];
  mechRoot: ComponentNode | null;
  onMechRootChange: (root: ComponentNode | null) => void;
  scale: ScaleType;
  setScale: (scale: ScaleType) => void;
  scaleMods: Record<ScaleType, ScaleModifiers>;
  setScaleMods: (mods: Record<ScaleType, ScaleModifiers>) => void;
}

type SlotTarget = { parentId: string | null; slotIndex: number | null }; 

const premadeLib = buildPremadeLib(allComponents as Record<string, PremadeData[]>);

function sumComponentPoints(node: ComponentNode | null): number {
  if (!node) return 0;
  let t = node.component.points;
  for (const child of node.children) if (child) t += sumComponentPoints(child);
  return t;
}

export function MechBuilder({ customComponents, mechRoot: rootNode, onMechRootChange: setRootNode, scale, setScale, scaleMods, setScaleMods }: MechBuilderProps) {
  const [pickingTarget, setPickingTarget] = useState<SlotTarget | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'graph'>('tree');
  const importRef = useRef<HTMLInputElement>(null);

  function exportMech() {
    if (!rootNode) return;
    const premadeIds = new Set(Object.keys(premadeLib).map(Number));
    const customIds = new Set<number>();
    collectCustomIds(rootNode, premadeIds, customIds);
    const customs: PremadeData[] = [];
    for (const id of customIds) {
      const found = customComponents.find(c => c.id === id);
      if (found) customs.push(found);
    }
    const stored: StoredBuild = { customs, tree: compactTree(rootNode) };
    const blob = new Blob([JSON.stringify(stored, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mech-build.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        // Old format: { mech: ComponentNode }
        if (raw?.mech?.id) {
          setRootNode(raw.mech);
          return;
        }
        // New compact format: { customs: [...], tree: CompactNode }
        if (raw?.tree) {
          const lib: Record<number, ReturnType<typeof premadeToComponent>> = {};
          for (const [id, p] of Object.entries(premadeLib)) {
            lib[Number(id)] = premadeToComponent(p as PremadeData);
          }
          for (const c of raw.customs ?? []) {
            if (c.id == null) continue;
            lib[c.id] = premadeToComponent(c);
          }
          const expanded = expandTree(raw.tree, lib);
          if (expanded) setRootNode(expanded);
        }
      } catch { /* ignore */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function addComponent(component: MechComponent, target: SlotTarget) {
    const newNode = createNode(component);
    const { parentId, slotIndex } = target;

    if (!rootNode) {
      setRootNode(newNode);
      return;
    }
    if (parentId === null || slotIndex === null) return;

    setRootNode(prev => {
      if (!prev) return prev;
      return addToSlot(prev, parentId, slotIndex, newNode);
    });
  }

  const handleSelectSlot = useCallback((parentId: string, slotIndex: number) => {
    setPickingTarget({ parentId, slotIndex });
  }, []);

  const handleSelectRoot = useCallback(() => {
    setPickingTarget({ parentId: null, slotIndex: null });
  }, []);

  const handlePick = useCallback(
    (component: MechComponent) => {
      if (!pickingTarget) return;
      addComponent(component, pickingTarget);
      setPickingTarget(null);
    },
    [rootNode, pickingTarget],
  );

  const handleClosePicker = useCallback(() => {
    setPickingTarget(null);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setRootNode(prev => {
      if (!prev) return prev;
      if (prev.id === id) return null;
      return removeById(prev, id);
    });
    setPickingTarget(null);
  }, []);

  const componentPoints = useMemo(() => sumComponentPoints(rootNode), [rootNode]);

  return (
    <div className="mech-builder">
      <div className="builder-body">
        <main className="main-area">
          <div className="builder-bar">
            <div className="bar-io">
              <button className="bar-btn" onClick={exportMech} disabled={!rootNode}>
                Export Mech
              </button>
              <button className="bar-btn" onClick={() => importRef.current?.click()}>
                Import Mech
              </button>
              <input ref={importRef} type="file" accept=".json" onChange={handleImport} hidden />
            </div>
            <div className="view-toggle">
              <button
                className={`toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
                onClick={() => setViewMode('tree')}
              >
                Tree View
              </button>
              <button
                className={`toggle-btn ${viewMode === 'graph' ? 'active' : ''}`}
                onClick={() => setViewMode('graph')}
              >
                Graph View
              </button>
            </div>
          </div>
          <div className={`view-container ${viewMode === 'graph' ? 'view-graph' : 'view-tree'}`}>
            {viewMode === 'tree' ? (
              rootNode ? (
                <MechTree
                  node={rootNode}
                  onSelectSlot={handleSelectSlot}
                  onRemove={handleRemove}
                />
              ) : (
                <RootSlot onSelectSlot={handleSelectRoot} />
              )
            ) : (
              <GraphView root={rootNode} />
            )}
          </div>
        </main>

        <SidePanel componentPoints={componentPoints} mechRoot={rootNode} scale={scale} setScale={setScale} scaleMods={scaleMods} setScaleMods={setScaleMods} />
      </div>

      {pickingTarget && (
        <ComponentPicker
          onPick={handlePick}
          onClose={handleClosePicker}
          customComponents={customComponents}
        />
      )}
    </div>
  );
}
