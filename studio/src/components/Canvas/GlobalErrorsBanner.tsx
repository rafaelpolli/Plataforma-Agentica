import { useState } from 'react';
import { useGraphStore } from '../../store/graphStore';

/**
 * Banner that surfaces validation errors not anchored to a specific node
 * (e.g., MISSING_INPUT_NODE, MISSING_OUTPUT_NODE, CYCLE_DETECTED).
 * Per-node errors render as red badges on the node itself.
 */
export function GlobalErrorsBanner() {
  const errors = useGraphStore((s) => s.validationErrors);
  const clearValidation = useGraphStore((s) => s.clearValidation);
  const [collapsed, setCollapsed] = useState(false);

  const globalErrors = errors.filter((e) => !e.node_id);
  if (globalErrors.length === 0) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-xl w-[90%] bg-red-950/90 border border-red-700 rounded-lg shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-red-800/60">
        <span className="text-red-400">⚠</span>
        <span className="text-sm font-semibold text-red-200">
          {globalErrors.length} graph-level error{globalErrors.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto text-xs text-red-300 hover:text-red-100 px-1.5"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▾' : '▴'}
        </button>
        <button
          onClick={clearValidation}
          className="text-xs text-red-300 hover:text-red-100 px-1.5"
          aria-label="Dismiss"
          title="Dismiss until next validation"
        >
          ✕
        </button>
      </div>
      {!collapsed && (
        <ul className="px-4 py-2 space-y-1 text-xs text-red-200">
          {globalErrors.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-red-400 flex-shrink-0">{e.code}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
