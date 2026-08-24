import { useState, useEffect, useRef } from 'react';
import type { ComponentCategory, MechComponent, PremadeData } from '../../types';
import { premadeToComponent, normalizeStr } from '../../types';
import './ComponentPicker.css';

interface ComponentPickerProps {
  onPick: (component: MechComponent) => void;
  onClose: () => void;
  customComponents?: PremadeData[];
  premadeData?: Record<string, PremadeData[]>;
}

const CATEGORIES: ComponentCategory[] = ['core', 'utility', 'weapon'];
const CAT_COLORS: Record<string, string> = {
  core: '#4fc3f7',
  utility: '#81c784',
  weapon: '#ef5350',
};

export function ComponentPicker({ onPick, onClose, customComponents = [], premadeData = {} }: ComponentPickerProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allItems: { data: PremadeData; group: ComponentCategory; isCustom?: boolean }[] = [
    ...CATEGORIES.flatMap(cat =>
      (premadeData[cat] ?? []).map(c => ({ data: { ...c, category: cat }, group: cat })),
    ),
    ...customComponents.map(c => ({ data: c, group: c.category, isCustom: true })),
  ];

  const filtered = search
    ? allItems.filter(c => normalizeStr(c.data.name).includes(normalizeStr(search)))
    : allItems;

  const grouped = CATEGORIES.map(cat => ({
    category: cat,
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    color: CAT_COLORS[cat] ?? '#888',
    items: filtered.filter(c => c.group === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={e => e.stopPropagation()}>
        <div className="picker-header">
          <h3>Choose Component</h3>
          <button className="picker-close" onClick={onClose}>✕</button>
        </div>

        <input
          ref={inputRef}
          className="picker-search"
          placeholder="Search components…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="picker-list">
          {grouped.map(g => (
            <div key={g.category} className="picker-group">
              <div className="picker-group-label" style={{ color: g.color }}>
                {g.label}
              </div>
              {g.items.map((item, i) => (
                <button
                  key={`${item.isCustom ? 'c' : 'p'}-${item.data.name}-${i}`}
                  className="picker-item"
                  onClick={() => onPick(premadeToComponent(item.data))}
                >
                  <span className="picker-item-name">{item.data.name}</span>
                  {item.isCustom && <span className="picker-item-badge">custom</span>}
                  <span className="picker-item-stats">
                    {item.data.points}p · {item.data.slots} slot{item.data.slots !== 1 ? 's' : ''}
                    {item.data.healthDivisor > 1 && ` · HP/${item.data.healthDivisor}`}
                  </span>
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="picker-empty">No matching components</div>
          )}
        </div>
      </div>
    </div>
  );
}
