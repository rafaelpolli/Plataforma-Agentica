import type { Project, ValidationResult } from '../types/graph';

const API_BASE = '/api';

export interface HealthResult {
  ok: boolean;
  timestamp?: string;
  error?: string;
}

export async function checkEngineHealth(signal?: AbortSignal): Promise<HealthResult> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = (await res.json()) as { status?: string; timestamp?: string };
    return { ok: body.status === 'ok', timestamp: body.timestamp };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function validateGraph(project: Project): Promise<ValidationResult> {
  const res = await fetch(`${API_BASE}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ValidationResult>;
}

export async function generateZip(project: Project): Promise<void> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { detail?: { message?: string } }).detail?.message ?? 'Generation failed';
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : 'agent.zip';

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
