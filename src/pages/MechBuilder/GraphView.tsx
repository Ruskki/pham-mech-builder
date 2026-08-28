import { useMemo, useRef, useEffect, useState } from 'react';
import type { ComponentNode } from '../../types';
import './GraphView.css';

interface FlatNode {
  id: string;
  label: string;
  category: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface FlatEdge {
  source: string;
  target: string;
}

function flatten(root: ComponentNode): { nodes: FlatNode[]; edges: FlatEdge[] } {
  const nodes: FlatNode[] = [];
  const edges: FlatEdge[] = [];
  let i = 0;

  function walk(node: ComponentNode) {
    const angle = (i++ * 1.618) * Math.PI * 2;
    nodes.push({
      id: node.id,
      label: node.component.name || 'Unnamed',
      category: node.component.category,
      x: Math.cos(angle) * 200,
      y: Math.sin(angle) * 200,
      vx: 0,
      vy: 0,
    });
    for (const child of node.children) {
      if (child) {
        edges.push({ source: node.id, target: child.id });
        walk(child);
      }
    }
  }

  walk(root);
  return { nodes, edges };
}

function simulate(
  nodes: FlatNode[],
  edges: FlatEdge[],
): FlatNode[] {
  const reps = 5000;
  const repulsion = 15000;
  const attraction = 0.001;
  const damping = 0.9;
  const center = 0.02;

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (let iter = 0; iter < reps; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        const fx = force * (dx / dist);
        const fy = force * (dy / dist);
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    for (const edge of edges) {
      const s = nodeMap.get(edge.source);
      const t = nodeMap.get(edge.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = attraction * dist;
      const fx = force * (dx / dist);
      const fy = force * (dy / dist);
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    for (const n of nodes) {
      n.vx -= n.x * center;
      n.vy -= n.y * center;
      n.vx *= damping;
      n.vy *= damping;
      const maxVel = 500;
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > maxVel) {
        n.vx = (n.vx / speed) * maxVel;
        n.vy = (n.vy / speed) * maxVel;
      }
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  return nodes;
}

function wrapLabel(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (test.length > maxLen && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const CAT_COLORS: Record<string, string> = {
  core: '#4fc3f7',
  utility: '#81c784',
  weapon: '#ef5350',
};

interface GraphViewProps {
  root: ComponentNode | null;
}

export function GraphView({ root }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cx, setCx] = useState(400);
  const [cy, setCy] = useState(300);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      setCx(rect.width / 2);
      setCy(rect.height / 2);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { nodes, edges } = useMemo(() => {
    if (!root) return { nodes: [], edges: [] };
    const { nodes: flatNodes, edges: flatEdges } = flatten(root);
    const simNodes = simulate(flatNodes, flatEdges);
    return { nodes: simNodes, edges: flatEdges };
  }, [root]);

  const connected = useMemo(() => {
    const set = new Set<string>();
    if (!hoveredId) return set;
    set.add(hoveredId);
    for (const e of edges) {
      if (e.source === hoveredId) set.add(e.target);
      if (e.target === hoveredId) set.add(e.source);
    }
    return set;
  }, [hoveredId, edges]);

  if (!root) {
    return (
      <div className="graph-view" ref={containerRef}>
        <div className="graph-empty">No components to display</div>
      </div>
    );
  }

  return (
    <div className="graph-view" ref={containerRef}>
      <svg style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          {edges.map(e => {
            const s = nodes.find(n => n.id === e.source);
            const t = nodes.find(n => n.id === e.target);
            if (!s || !t) return null;
            return (
              <marker
                key={`arrow-${e.source}-${e.target}`}
                id={`arrow-${e.source}-${e.target}`}
                viewBox="0 0 10 10"
                refX={48}
                refY={5}
                markerWidth={6}
                markerHeight={6}
                orient="auto"
              >
                <path d="M0,0 L10,5 L0,10 Z" fill="#888" />
              </marker>
            );
          })}
        </defs>

        {edges.map(e => {
          const s = nodes.find(n => n.id === e.source);
          const t = nodes.find(n => n.id === e.target);
          if (!s || !t) return null;
          const isHighlighted = hoveredId && (connected.has(s.id) && connected.has(t.id));
          return (
            <line
              key={`${e.source}-${e.target}`}
              x1={cx + s.x}
              y1={cy + s.y}
              x2={cx + t.x}
              y2={cy + t.y}
              stroke={isHighlighted ? '#fff' : '#555'}
              strokeWidth={isHighlighted ? 2 : 1}
              markerEnd={`url(#arrow-${e.source}-${e.target})`}
            />
          );
        })}

        {nodes.map(n => {
          const isHovered = n.id === hoveredId;
          const isConnected = hoveredId && connected.has(n.id);
          const opacity = !hoveredId || isConnected ? 1 : 0.3;
          const r = isHovered ? 47 : 41;
          return (
            <g
              key={n.id}
              transform={`translate(${cx + n.x}, ${cy + n.y})`}
              opacity={opacity}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={r}
                fill={n.id === root?.id ? '#e2c541' : (CAT_COLORS[n.category] ?? '#888')}
                stroke={isHovered ? '#fff' : 'transparent'}
                strokeWidth={2}
              />
              <text
                textAnchor="middle"
                fill="#111"
                fontSize={12}
                fontWeight={600}
                style={{ pointerEvents: 'none' }}
              >
                {wrapLabel(n.label, 14).map((line, i, arr) => {
                  const offset = (i - (arr.length - 1) / 2) * 1.2;
                  return (
                    <tspan key={i} x={0} dy={i === 0 ? `${offset}em` : '1.2em'}>
                      {line}
                    </tspan>
                  );
                })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
