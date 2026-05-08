import { useCallback, useMemo, Suspense, lazy } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { NODE_CATALOG, type FieldDef, type NodeRefFilter } from '../../nodes/catalog';
import type { AgentNode, NodeType } from '../../types/graph';

const TOOL_NODE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'tool_custom', 'tool_athena', 'tool_s3', 'tool_http', 'tool_bedrock',
]);

function nodeMatchesFilter(node: AgentNode, currentNodeId: string, filter: NodeRefFilter): boolean {
  if (node.id === currentNodeId) return false;
  if (filter === 'tool') return TOOL_NODE_TYPES.has(node.type);
  if (filter === 'agent') return node.type === 'agent';
  if (filter === 'worker_agent') return node.type === 'agent' || node.type === 'multi_agent_coordinator';
  return false;
}

interface NodeRefListFieldProps {
  fieldDef: FieldDef;
  currentNodeId: string;
  value: unknown;
  onChange: (value: string[]) => void;
}

function NodeRefListField({ fieldDef, currentNodeId, value, onChange }: NodeRefListFieldProps) {
  const allNodes = useGraphStore((s) => s.nodes);
  const filter = fieldDef.nodeFilter ?? 'tool';
  const candidates = useMemo(
    () => allNodes
      .map((fn) => fn.data.node)
      .filter((n) => nodeMatchesFilter(n, currentNodeId, filter)),
    [allNodes, currentNodeId, filter],
  );
  const selected = Array.isArray(value) ? (value as string[]) : [];

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  if (candidates.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic px-2 py-1.5 bg-gray-50 rounded border border-gray-200">
        No matching nodes on the canvas. Add a {filter === 'tool' ? 'tool' : 'agent'} node first.
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-2">
      {candidates.map((n) => {
        const def = NODE_CATALOG[n.type];
        const checked = selected.includes(n.id);
        return (
          <label
            key={n.id}
            className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 transition-colors"
            onMouseEnter={(e) => { (e.currentTarget as HTMLLabelElement).style.background = '#FFF8F4'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.background = ''; }}
          >
            <input
              type="checkbox"
              className="w-4 h-4"
              style={{ accentColor: '#FF6200' }}
              checked={checked}
              onChange={() => toggle(n.id)}
            />
            <span className="text-base leading-none">{def.icon}</span>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs truncate" style={{ color: '#0f0f0f' }}>{n.label}</div>
              <div className="text-xs text-gray-500 truncate font-mono">{n.id}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

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
  if (parts.length === 1) { result[key] = value; return result; }
  const [head, ...rest] = parts;
  const child = (typeof result[head] === 'object' && result[head] !== null)
    ? { ...(result[head] as Record<string, unknown>) }
    : {};
  result[head] = setNestedValue(child, rest.join('.'), value);
  return result;
}

const INPUT_CLS = 'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none placeholder-gray-400';

function focusOrange(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = '#FF6200';
}
function blurGray(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = '';
}

interface FieldProps {
  fieldDef: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  currentNodeId: string;
}

function Field({ fieldDef, value, onChange, currentNodeId }: FieldProps) {
  const strVal = value == null ? '' : String(value);
  const numVal = value == null ? '' : Number(value);
  const boolVal = Boolean(value);

  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {fieldDef.label}
        {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {fieldDef.type === 'string' || fieldDef.type === 'secret_ref' ? (
        <input
          type="text"
          className={INPUT_CLS}
          value={strVal}
          placeholder={fieldDef.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={focusOrange}
          onBlur={blurGray}
        />
      ) : fieldDef.type === 'textarea' ? (
        <textarea
          className={`${INPUT_CLS} resize-y min-h-[80px] font-mono text-xs`}
          value={strVal}
          placeholder={fieldDef.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={focusOrange}
          onBlur={blurGray}
          rows={4}
        />
      ) : fieldDef.type === 'code' ? (
        <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 180 }}>
          <Suspense fallback={<div className="p-2 text-xs text-gray-400">Carregando editor…</div>}>
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
          className={`${INPUT_CLS} cursor-pointer`}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          onFocus={focusOrange}
          onBlur={blurGray}
        >
          {!fieldDef.required && <option value="">— selecionar —</option>}
          {fieldDef.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : fieldDef.type === 'boolean' ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded"
            style={{ accentColor: '#FF6200' }}
            checked={boolVal}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm text-gray-600">{boolVal ? 'Habilitado' : 'Desabilitado'}</span>
        </label>
      ) : fieldDef.type === 'number' ? (
        <input
          type="number"
          className={INPUT_CLS}
          value={numVal}
          min={fieldDef.min}
          max={fieldDef.max}
          step={fieldDef.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={focusOrange}
          onBlur={blurGray}
        />
      ) : fieldDef.type === 'node_ref_list' ? (
        <NodeRefListField
          fieldDef={fieldDef}
          currentNodeId={currentNodeId}
          value={value}
          onChange={onChange}
        />
      ) : null}

      {fieldDef.hint && (
        <p className="mt-1 text-xs text-gray-400">{fieldDef.hint}</p>
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
      <div className="mb-4 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <label className="block text-xs font-medium text-gray-700 mb-1">Node label</label>
        <input
          type="text"
          className={INPUT_CLS}
          value={node.label}
          onChange={(e) => onLabelChange(e.target.value)}
          onFocus={focusOrange}
          onBlur={blurGray}
        />
      </div>

      {def.configSchema.map((fieldDef) => (
        <Field
          key={fieldDef.key}
          fieldDef={fieldDef}
          value={getNestedValue(node.config, fieldDef.key)}
          onChange={(v) => handleFieldChange(fieldDef.key, v)}
          currentNodeId={node.id}
        />
      ))}
    </div>
  );
}

export function ConfigPanel() {
  const selectedNodeId  = useGraphStore((s) => s.selectedNodeId);
  const node = useGraphStore((s) => {
    if (!s.selectedNodeId) return null;
    const found = s.nodes.find((n) => n.id === s.selectedNodeId);
    return found ? found.data.node : null;
  });
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig);
  const updateNodeLabel  = useGraphStore((s) => s.updateNodeLabel);
  const removeNode       = useGraphStore((s) => s.removeNode);

  if (!node) {
    return (
      <aside className="w-72 flex-shrink-0 bg-white flex items-center justify-center" style={{ borderLeft: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="text-center text-gray-400 px-6">
          <div className="text-3xl mb-2">⚙️</div>
          <div className="text-sm">Selecione um node para configurar</div>
        </div>
      </aside>
    );
  }

  const def = NODE_CATALOG[node.type];

  return (
    <aside className="w-72 flex-shrink-0 bg-white flex flex-col h-full" style={{ borderLeft: '1px solid rgba(0,0,0,0.07)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <span className="text-xl">{def.icon}</span>
        <div className="flex-1 overflow-hidden">
          <div className="font-semibold text-sm truncate" style={{ color: '#0f0f0f' }}>{node.label}</div>
          <div className="text-gray-500 text-xs">{def.label}</div>
        </div>
        <button
          onClick={() => removeNode(node.id)}
          className="text-gray-400 hover:text-red-500 text-sm transition-colors"
          title="Deletar node"
        >
          🗑
        </button>
      </div>

      {/* Ports reference */}
      {(node.ports.inputs.length > 0 || node.ports.outputs.length > 0) && (
        <div className="px-4 py-2 bg-gray-50" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Ports</div>
          <div className="flex gap-4">
            {node.ports.inputs.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1">In</div>
                {node.ports.inputs.map((p) => (
                  <div key={p.id} className="text-xs text-gray-600">
                    <span className="font-mono" style={{ color: '#FF6200' }}>{p.id}</span>{' '}
                    <span className="text-gray-400">({p.data_type})</span>
                  </div>
                ))}
              </div>
            )}
            {node.ports.outputs.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1">Out</div>
                {node.ports.outputs.map((p) => (
                  <div key={p.id} className="text-xs text-gray-600">
                    <span className="font-mono" style={{ color: '#FF6200' }}>{p.id}</span>{' '}
                    <span className="text-gray-400">({p.data_type})</span>
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
          <div className="text-sm text-gray-400">Nenhuma configuração necessária.</div>
        ) : (
          <NodeConfigForm
            node={node}
            onConfigChange={(config) => { if (selectedNodeId) updateNodeConfig(selectedNodeId, config); }}
            onLabelChange={(label) => { if (selectedNodeId) updateNodeLabel(selectedNodeId, label); }}
          />
        )}
      </div>
    </aside>
  );
}
