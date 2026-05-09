import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Connection,
  type NodeTypes,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { CustomNode } from './CustomNode';
import { GlobalErrorsBanner } from './GlobalErrorsBanner';
import { useGraphStore, type AppFlowNode } from '../../../store/graphStore';
import { NODE_CATALOG, DATA_TYPE_COMPATIBLE } from '../../../nodes/catalog';
import type { AgentNode, NodeType } from '../../../types/graph';

const nodeTypes: NodeTypes = { customNode: CustomNode };

function CanvasInner() {
  const reactFlow = useReactFlow<AppFlowNode>();

  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const addAgentNode = useGraphStore((s) => s.addAgentNode);
  const selectNode = useGraphStore((s) => s.selectNode);

  const handleConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const sourcePort = sourceNode?.data.node.ports.outputs.find(
        (p) => p.id === connection.sourceHandle,
      );
      const targetNode = nodes.find((n) => n.id === connection.target);
      const targetPort = targetNode?.data.node.ports.inputs.find(
        (p) => p.id === connection.targetHandle,
      );

      if (sourcePort && targetPort && !DATA_TYPE_COMPATIBLE(sourcePort.data_type, targetPort.data_type)) {
        return;
      }

      onConnect(connection, sourcePort?.data_type ?? 'any');
    },
    [nodes, onConnect],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('application/node-type') as NodeType;
      if (!nodeType || !NODE_CATALOG[nodeType]) return;

      const position = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const def = NODE_CATALOG[nodeType];
      const id = `${nodeType}_${Date.now()}`;
      const newNode: AgentNode = {
        id,
        type: nodeType,
        label: def.label,
        position,
        config: JSON.parse(JSON.stringify(def.defaultConfig)),
        ports: JSON.parse(JSON.stringify(def.defaultPorts)),
      };
      addAgentNode(newNode);
      selectNode(id);
    },
    [reactFlow, addAgentNode, selectNode],
  );

  return (
    <div className="flex-1 h-full bg-surface relative">
      <GlobalErrorsBanner />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        deleteKeyCode="Delete"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          animated: false,
        }}
      >
        <Background variant={BackgroundVariant.Dots} color="#d1d5db" gap={20} size={1} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(n) => {
            const node = (n as AppFlowNode).data?.node;
            if (!node) return '#d1d5db';
            const def = NODE_CATALOG[node.type];
            const colorMap: Record<string, string> = {
              'border-blue-500': '#3b82f6',
              'border-purple-500': '#a855f7',
              'border-orange-500': '#f97316',
              'border-yellow-500': '#eab308',
              'border-green-500': '#22c55e',
              'border-teal-500': '#14b8a6',
              'border-pink-500': '#ec4899',
            };
            return colorMap[def.categoryColor] ?? '#9ca3af';
          }}
          maskColor="rgba(250, 250, 248, 0.8)"
        />
      </ReactFlow>
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
