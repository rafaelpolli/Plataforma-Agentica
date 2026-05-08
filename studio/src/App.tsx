import { Toolbar } from './components/Toolbar/Toolbar';
import { NodePanel } from './components/NodePanel/NodePanel';
import { Canvas } from './components/Canvas/Canvas';
import { ConfigPanel } from './components/ConfigPanel/ConfigPanel';

export default function App() {
  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <NodePanel />
        <Canvas />
        <ConfigPanel />
      </div>
    </div>
  );
}
