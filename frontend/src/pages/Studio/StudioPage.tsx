import { useAuthStore } from '../../store/authStore';
import { Toolbar } from './Toolbar/Toolbar';
import { NodePanel } from './NodePanel/NodePanel';
import { Canvas } from './Canvas/Canvas';
import { ConfigPanel } from './ConfigPanel/ConfigPanel';

export function StudioPage() {
  const { token } = useAuthStore();

  // Studio gets its JWT token from authStore for engine/git API calls.
  // The components read it via useAuthStore where needed.

  return (
    <div className="flex flex-col h-full bg-surface">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <NodePanel />
        <Canvas />
        <ConfigPanel />
      </div>
    </div>
  );
}
