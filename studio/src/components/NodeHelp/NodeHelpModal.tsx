import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { NODE_CATALOG, PORT_COLORS } from '../../nodes/catalog';
import { getCompatibleSources, getCompatibleTargets, type CompatiblePort } from './portCompatibility';
import type { AgentNode, Port } from '../../types/graph';

interface Props {
  node: AgentNode;
  onClose: () => void;
}

function TypeBadge({ dataType }: { dataType: string }) {
  const dot = PORT_COLORS[dataType] ?? 'bg-gray-400';
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-700 text-xs font-mono text-gray-200">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {dataType}
    </span>
  );
}

function CompatChip({ item }: { item: CompatiblePort }) {
  return (
    <span className="inline-flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-full px-2 py-0.5 text-xs text-gray-300 whitespace-nowrap">
      <span>{item.nodeIcon}</span>
      <span className="font-medium">{item.nodeLabel}</span>
      <span className="text-gray-500 font-light">{item.portName}</span>
    </span>
  );
}

function PortRow({ port, direction }: { port: Port; direction: 'input' | 'output' }) {
  const list = direction === 'input'
    ? getCompatibleSources(port.data_type)
    : getCompatibleTargets(port.data_type);

  const isAny = port.data_type === 'any';
  const verb = direction === 'input' ? 'Receives from' : 'Connects to';

  return (
    <div className="py-3 border-b border-gray-800 last:border-b-0">
      <div className="flex items-center gap-2 mb-2">
        <TypeBadge dataType={port.data_type} />
        <span className="text-white text-sm font-semibold">{port.name}</span>
        {direction === 'input' && port.required && (
          <span className="text-red-400 text-xs bg-red-900/30 px-1.5 py-0.5 rounded">required</span>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-2">{verb}:</p>

      {isAny ? (
        <p className="text-xs text-gray-400 italic">
          {direction === 'input'
            ? 'Accepts any data type — connect from any node output.'
            : 'Emits any data type — connect to any node input.'}
        </p>
      ) : list.length === 0 ? (
        <p className="text-xs text-gray-600 italic">No compatible nodes found.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {list.map((item, i) => (
            <CompatChip key={`${item.nodeType}-${item.portName}-${i}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NodeHelpModal({ node, onClose }: Props) {
  const def = NODE_CATALOG[node.type];

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 540, maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-700 flex-shrink-0">
          <span className="text-3xl leading-none mt-0.5">{def.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-white font-bold text-base">{def.label}</h2>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full font-mono">
                {def.category}
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{def.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none p-1 flex-shrink-0"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Inputs */}
          {node.ports.inputs.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Inputs
              </h3>
              {node.ports.inputs.map((port) => (
                <PortRow key={port.id} port={port} direction="input" />
              ))}
            </div>
          )}

          {/* Outputs */}
          {node.ports.outputs.length > 0 && (
            <div className="px-5 pt-4 pb-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Outputs
              </h3>
              {node.ports.outputs.map((port) => (
                <PortRow key={port.id} port={port} direction="output" />
              ))}
            </div>
          )}

          {node.ports.inputs.length === 0 && node.ports.outputs.length === 0 && (
            <p className="px-5 py-6 text-gray-600 text-sm text-center">This node has no ports.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
