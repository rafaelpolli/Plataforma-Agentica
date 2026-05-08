import { useState, useCallback } from 'react';
import { NODE_CATALOG, NODE_CATEGORIES, CATEGORY_NODES, type NodeCategory } from '../../nodes/catalog';
import type { NodeType } from '../../types/graph';

interface NodeCardProps {
  nodeType: NodeType;
}

function NodeCard({ nodeType }: NodeCardProps) {
  const def = NODE_CATALOG[nodeType];

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/node-type', nodeType);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [nodeType],
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-start gap-2 px-2 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
      style={{ '--hover-bg': '#FFF8F4' } as React.CSSProperties}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#FFF8F4'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
      title={def.description}
    >
      <span className="text-base leading-tight mt-0.5 flex-shrink-0">{def.icon}</span>
      <div className="overflow-hidden">
        <div className="text-sm font-medium leading-tight truncate" style={{ color: '#0f0f0f' }}>{def.label}</div>
        <div className="text-xs text-gray-500 truncate">{def.description}</div>
      </div>
    </div>
  );
}

interface CategorySectionProps {
  category: NodeCategory;
  search: string;
}

function CategorySection({ category, search }: CategorySectionProps) {
  const [open, setOpen] = useState(true);
  const types = CATEGORY_NODES[category];
  const filtered = search
    ? types.filter((t) => {
        const def = NODE_CATALOG[t];
        const q = search.toLowerCase();
        return def.label.toLowerCase().includes(q) || def.description.toLowerCase().includes(q);
      })
    : types;

  if (filtered.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
      >
        <span>{category}</span>
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="space-y-0.5">
          {filtered.map((t) => (
            <NodeCard key={t} nodeType={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NodePanel() {
  const [search, setSearch] = useState('');

  return (
    <aside className="w-60 flex-shrink-0 bg-white flex flex-col h-full" style={{ borderRight: '1px solid rgba(0,0,0,0.07)' }}>
      {/* Header */}
      <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nodes</div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nodes..."
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none transition-colors"
          onFocus={(e) => { e.target.style.borderColor = '#FF6200'; }}
          onBlur={(e) => { e.target.style.borderColor = ''; }}
        />
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {NODE_CATEGORIES.map((cat) => (
          <CategorySection key={cat} category={cat} search={search} />
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 text-xs text-gray-400" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
        Arraste nodes para o canvas
      </div>
    </aside>
  );
}
