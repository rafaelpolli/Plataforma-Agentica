import type { Project, ValidationResult } from '../types/graph';

/**
 * Engine base URL.
 *
 * Local dev: defaults to '/api', proxied to http://localhost:8000 by vite.config.ts.
 * Production: set VITE_API_BASE=https://your-engine-host.example.com at build time.
 * Trailing slash is stripped so callers can always use `${API_BASE}/path`.
 */
const RAW_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';
const API_BASE = RAW_BASE.replace(/\/+$/, '');

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

export async function validateGraph(project: Project, token: string): Promise<ValidationResult> {
  const res = await fetch(`${API_BASE}/agents/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ValidationResult>;
}

export async function generateZip(project: Project, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
