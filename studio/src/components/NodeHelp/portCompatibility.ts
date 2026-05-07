import { NODE_CATALOG, DATA_TYPE_COMPATIBLE } from '../../nodes/catalog';
import type { NodeType } from '../../types/graph';

export interface CompatiblePort {
  nodeType: NodeType;
  nodeLabel: string;
  nodeIcon: string;
  portName: string;
}

/** Which node outputs can feed into an input port of `targetDataType`. */
export function getCompatibleSources(targetDataType: string): CompatiblePort[] {
  if (targetDataType === 'any') return []; // handled specially in UI — accepts everything
  const results: CompatiblePort[] = [];
  for (const [nodeType, def] of Object.entries(NODE_CATALOG)) {
    for (const port of def.defaultPorts.outputs) {
      if (DATA_TYPE_COMPATIBLE(port.data_type, targetDataType)) {
        results.push({
          nodeType: nodeType as NodeType,
          nodeLabel: def.label,
          nodeIcon: def.icon,
          portName: port.name,
        });
      }
    }
  }
  return results;
}

/** Which node inputs an output port of `sourceDataType` can feed into. */
export function getCompatibleTargets(sourceDataType: string): CompatiblePort[] {
  if (sourceDataType === 'any') return []; // handled specially in UI — feeds into everything
  const results: CompatiblePort[] = [];
  for (const [nodeType, def] of Object.entries(NODE_CATALOG)) {
    for (const port of def.defaultPorts.inputs) {
      if (DATA_TYPE_COMPATIBLE(sourceDataType, port.data_type)) {
        results.push({
          nodeType: nodeType as NodeType,
          nodeLabel: def.label,
          nodeIcon: def.icon,
          portName: port.name,
        });
      }
    }
  }
  return results;
}
