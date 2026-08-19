import { useState } from 'react';
import type { ComponentNode } from '../../types';
import './MechTree.css';

interface MechTreeProps {
  node: ComponentNode;
  onSelectSlot: (parentId: string, slotIndex: number) => void;
  onRemove: (id: string) => void;
}

const CAT_COLORS: Record<string, string> = {
  core: '#4fc3f7',
  utility: '#81c784',
  weapon: '#ef5350',
};

function ComponentCard({
  node,
  onRemove,
}: {
  node: ComponentNode;
  onRemove: (id: string) => void;
}) {
  const { component } = node;
  const color = CAT_COLORS[component.category] ?? '#888';
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="comp-card" style={{ borderLeftColor: color }}>
      <div className="comp-card-header" onClick={() => setCollapsed(v => !v)} style={{ cursor: 'pointer' }}>
        <span className="collapse-arrow">{collapsed ? '▸' : '▾'}</span>
        <span className="comp-cat-badge" style={{ background: color }}>
          {component.category}
        </span>
        <span className="comp-name">{component.name || 'Unnamed'}</span>
        <span className="comp-stat" style={{ marginRight: '0.5rem' }}>{component.points}p</span>
        <button className="remove-btn" onClick={e => { e.stopPropagation(); onRemove(node.id); }} title="Remove">
          ✕
        </button>
      </div>
      {!collapsed && (
        <div className="comp-card-body">
          <span className="comp-stat">Type: {component.type || '—'}</span>
          <span className="comp-stat">Pts: {component.points}</span>
          <span className="comp-stat">HP /{component.healthDivisor}</span>
          <span className="comp-stat">{component.slots} slot{component.slots !== 1 ? 's' : ''}</span>
          {component.attrRange && (
            <span className="comp-stat">Range: {component.attrRange}</span>
          )}
          {component.weight !== undefined && <span className="comp-stat">Wt: {component.weight}</span>}
          {component.dexMod !== undefined && <span className="comp-stat">Dex: {component.dexMod > 0 ? '+' : ''}{component.dexMod}</span>}
          {component.strMod !== undefined && <span className="comp-stat">Str: {component.strMod > 0 ? '+' : ''}{component.strMod}</span>}
          {component.radMod !== undefined && <span className="comp-stat">Rad: {component.radMod > 0 ? '+' : ''}{component.radMod}</span>}
          {component.conMod !== undefined && <span className="comp-stat">Con: {component.conMod > 0 ? '+' : ''}{component.conMod}</span>}
          {component.acMod !== undefined && <span className="comp-stat">AC: {component.acMod > 0 ? '+' : ''}{component.acMod}</span>}
          {component.acroMod !== undefined && <span className="comp-stat">Acro: {component.acroMod > 0 ? '+' : ''}{component.acroMod}</span>}
          {component.sigMod !== undefined && <span className="comp-stat">Sig: {component.sigMod > 0 ? '+' : ''}{component.sigMod}</span>}
          {component.rendMod !== undefined && <span className="comp-stat">Rend: {component.rendMod > 0 ? '+' : ''}{component.rendMod}</span>}
          {component.movement !== undefined && <span className="comp-stat">Mov: {component.movement}</span>}
          {component.description && (
            <p className="comp-desc">{component.description}</p>
          )}
          {component.category === 'utility' && (
            <>
              <span className="comp-stat">Action: {(component as any).actionType || '—'}</span>
              <span className="comp-stat">Range: {(component as any).range || '—'}</span>
              <span className="comp-stat">Energy: {(component as any).energy}</span>
              {(component as any).oneTimeUse && <span className="comp-stat">One-time Use</span>}
            </>
          )}
          {component.category === 'weapon' && (
            <>
              <span className="comp-stat">Action: {(component as any).actionType || '—'}</span>
              <span className="comp-stat">Range: {(component as any).range || '—'}</span>
              <span className="comp-stat">Ammo: {(component as any).ammoType || '—'} ({(component as any).ammoCost})</span>
              <span className="comp-stat">Weapon: {(component as any).weaponType || '—'} / {(component as any).weaponSubtype || '—'}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MechTree({ node, onSelectSlot, onRemove }: MechTreeProps) {
  if (!node) return null;

  return (
    <div className="tree-node">
      <ComponentCard node={node} onRemove={onRemove} />

      {node.children.length > 0 && (
        <div className="slots-container">
          {node.children.map((child, index) => (
            <div key={index} className="slot-wrapper">
              <div className="slot-header">
                <span className="slot-label">Slot {index + 1}</span>
                <span className="slot-connector" />
              </div>
              {child ? (
                <MechTree
                  node={child}
                  onSelectSlot={onSelectSlot}
                  onRemove={onRemove}
                />
              ) : (
                <button
                  className="slot-add-btn"
                  onClick={() => onSelectSlot(node.id, index)}
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RootSlotProps {
  onSelectSlot: () => void;
}

export function RootSlot({ onSelectSlot }: RootSlotProps) {
  return (
    <div className="root-slot">
      <button className="slot-add-btn root-add-btn" onClick={onSelectSlot}>
        + Add Root Component
      </button>
    </div>
  );
}
