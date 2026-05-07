import { useCallback, Suspense, lazy } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { NODE_CATALOG, type FieldDef } from '../../nodes/catalog';
import type { AgentNode } from '../../types/graph';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function setNestedValue(obj: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const result = { ...obj };
  const parts = key.split('.');
  if (parts.length === 1) {
    result[key] = value;
    return result;
  }
  const [head, ...rest] = parts;
  const child = (typeof result[head] === 'object' && result[head] !== null)
    ? { ...(result[head] as Record<string, unknown>) }
    : {};
  result[head] = setNestedValue(child, rest.join('.'), value);
  return result;
}

interface FieldProps {
  fieldDef: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}

function Field({ fieldDef, value, onChange }: FieldProps) {
  const strVal = value == null ? '' : String(value);
  const numVal = value == null ? '' : Number(value);
  const boolVal = Boolean(value);

  const inputCls = 'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-500';

  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-300 mb-1">
        {fieldDef.label}
        {fieldDef.required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {fieldDef.type === 'string' || fieldDef.type === 'secret_ref' ? (
        <input
          type="text"
          className={inputCls}
          value={strVal}
          placeholder={fieldDef.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : fieldDef.type === 'textarea' ? (
        <textarea
          className={`${inputCls} resize-y min-h-[80px] font-mono text-xs`}
          value={strVal}
          placeholder={fieldDef.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      ) : fieldDef.type === 'code' ? (
        <div className="rounded-lg overflow-hidden border border-gray-600" style={{ height: 180 }}>
          <Suspense fallback={<div className="p-2 text-xs text-gray-400">Loading editor…</div>}>
            <MonacoEditor
              height={180}
              language={fieldDef.language ?? 'python'}
              theme="vs-dark"
              value={strVal}
              onChange={(v) => onChange(v ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 8, bottom: 8 },
              }}
            />
          </Suspense>
        </div>
      ) : fieldDef.type === 'enum' ? (
        <select
          className={`${inputCls} cursor-pointer`}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
        >
          {!fieldDef.required && <option value="">— select —</option>}
          {fieldDef.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : fieldDef.type === 'boolean' ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-blue-500"
            checked={boolVal}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm text-gray-300">{boolVal ? 'Enabled' : 'Disabled'}</span>
        </label>
      ) : fieldDef.type === 'number' ? (
        <input
          type="number"
          className={inputCls}
          value={numVal}
          min={fieldDef.min}
          max={fieldDef.max}
          step={fieldDef.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      ) : null}

      {fieldDef.hint && (
        <p className="mt-1 text-xs text-gray-500">{fieldDef.hint}</p>
      )}
    </div>
  );
}

interface NodeConfigFormProps {
  node: AgentNode;
  onConfigChange: (config: Record<string, unknown>) => void;
  onLabelChange: (label: string) => void;
}

function NodeConfigForm({ node, onConfigChange, onLabelChange }: NodeConfigFormProps) {
  const def = NODE_CATALOG[node.type];

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      onConfigChange(setNestedValue(node.config, key, value));
    },
    [node.config, onConfigChange],
  );

  return (
    <div>
      {/* Label */}
      <div className="mb-4 pb-4 border-b border-gray-700">
        <label className="block text-xs font-medium text-gray-300 mb-1">Node label</label>
        <input
          type="text"
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          value={node.label}
          onChange={(e) => onLabelChange(e.target.value)}
        />
      </div>

      {/* Config fields */}
      {def.configSchema.map((fieldDef) => (
        <Field
          key={fieldDef.key}
          fieldDef={fieldDef}
          value={getNestedValue(node.config, fieldDef.key)}
          onChange={(v) => handleFieldChange(fieldDef.key, v)}
        />
      ))}
    </div>
  );
}

export function ConfigPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const node = useGraphStore((s) => {
    if (!s.selectedNodeId) return null;
    const found = s.nodes.find((n) => n.id === s.selectedNodeId);
    return found ? found.data.node : null;
  });
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useGraphStore((s) => s.updateNodeLabel);
  const removeNode = useGraphStore((s) => s.removeNode);

  if (!node) {
    return (
      <aside className="w-72 flex-shrink-0 bg-gray-900 border-l border-gray-700 flex items-center justify-center">
        <div className="text-center text-gray-500 px-6">
          <div className="text-3xl mb-2">⚙️</div>
          <div className="text-sm">Select a node to configure it</div>
        </div>
      </aside>
    );
  }

  const def = NODE_CATALOG[node.type];

  return (
    <aside className="w-72 flex-shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <span className="text-xl">{def.icon}</span>
        <div className="flex-1 overflow-hidden">
          <div className="text-white font-semibold text-sm truncate">{node.label}</div>
          <div className="text-gray-400 text-xs">{def.label}</div>
        </div>
        <button
          onClick={() => removeNode(node.id)}
          className="text-gray-500 hover:text-red-400 text-sm transition-colors"
          title="Delete node"
        >
          🗑
        </button>
      </div>

      {/* Port reference */}
      {(node.ports.inputs.length > 0 || node.ports.outputs.length > 0) && (
        <div className="px-4 py-2 border-b border-gray-700 bg-gray-800">
          <div className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Ports</div>
          <div className="flex gap-4">
            {node.ports.inputs.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1">In</div>
                {node.ports.inputs.map((p) => (
                  <div key={p.id} className="text-xs text-gray-300">
                    <span className="font-mono text-blue-400">{p.id}</span>{' '}
                    <span className="text-gray-500">({p.data_type})</span>
                  </div>
                ))}
              </div>
            )}
            {node.ports.outputs.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Out</div>
                {node.ports.outputs.map((p) => (
                  <div key={p.id} className="text-xs text-gray-300">
                    <span className="font-mono text-orange-400">{p.id}</span>{' '}
                    <span className="text-gray-500">({p.data_type})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Config form */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {def.configSchema.length === 0 ? (
          <div className="text-sm text-gray-500">No configuration required.</div>
        ) : (
          <NodeConfigForm
            node={node}
            onConfigChange={(config) => {
              if (selectedNodeId) updateNodeConfig(selectedNodeId, config);
            }}
            onLabelChange={(label) => {
              if (selectedNodeId) updateNodeLabel(selectedNodeId, label);
            }}
          />
        )}
      </div>
    </aside>
  );
}
