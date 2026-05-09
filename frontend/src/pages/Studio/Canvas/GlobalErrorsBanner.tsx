import { useState } from 'react';
import { useGraphStore } from '../../../store/graphStore';

export function GlobalErrorsBanner() {
  const errors = useGraphStore((s) => s.validationErrors);
  const clearValidation = useGraphStore((s) => s.clearValidation);
  const [collapsed, setCollapsed] = useState(false);

  const globalErrors = errors.filter((e) => !e.node_id);
  if (globalErrors.length === 0) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-xl w-[90%] bg-red-50 border border-red-200 rounded-lg shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-red-200">
        <span className="text-red-500">⚠</span>
        <span className="text-sm font-semibold text-red-700">
          {globalErrors.length} graph-level error{globalErrors.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto text-xs text-red-500 hover:text-red-700 px-1.5"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▾' : '▴'}
        </button>
        <button
          onClick={clearValidation}
          className="text-xs text-red-500 hover:text-red-700 px-1.5"
          aria-label="Dismiss"
          title="Dismiss until next validation"
        >
          ✕
        </button>
      </div>
      {!collapsed && (
        <ul className="px-4 py-2 space-y-1 text-xs text-red-600">
          {globalErrors.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-red-500 flex-shrink-0">{e.code}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
