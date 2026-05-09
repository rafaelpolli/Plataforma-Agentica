import type { Project } from '../types/graph';

const RAW_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';
const API_BASE = RAW_BASE.replace(/\/+$/, '');

export type GitProvider = 'github' | 'gitlab';

export interface GitPushArgs {
  provider: GitProvider;
  repo: string;
  branch: string;
  token: string;
  commitMessage: string;
  project: Project;
  baseUrl?: string;
  authToken?: string;
}

export interface GitPushResult {
  ok: true;
  provider: GitProvider;
  repo: string;
  branch: string;
  files_committed: number;
  commit_sha: string;
  commit_url: string;
}

export interface GitPullArgs {
  provider: GitProvider;
  repo: string;
  ref: string;
  token: string;
  path?: string;
  baseUrl?: string;
  authToken?: string;
}

export interface GitPullResult {
  ok: true;
  provider: GitProvider;
  repo: string;
  ref: string;
  path: string;
  project: Project;
}

class GitApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'GitApiError';
  }
}

async function unwrapError(res: Response): Promise<never> {
  const ct = res.headers.get('Content-Type') ?? '';
  let message = `HTTP ${res.status}`;
  if (ct.includes('application/json')) {
    const body = (await res.json().catch(() => ({}))) as { detail?: { message?: string } | string };
    if (typeof body.detail === 'string') message = body.detail;
    else if (body.detail?.message) message = body.detail.message;
  } else {
    message = (await res.text().catch(() => message)) || message;
  }
  throw new GitApiError(message, res.status);
}

export async function gitPush(args: GitPushArgs): Promise<GitPushResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (args.authToken) headers['Authorization'] = `Bearer ${args.authToken}`;

  const res = await fetch(`${API_BASE}/agents/git/push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: args.provider,
      repo: args.repo,
      branch: args.branch,
      token: args.token,
      commit_message: args.commitMessage,
      project: args.project,
      base_url: args.baseUrl,
    }),
  });
  if (!res.ok) await unwrapError(res);
  return res.json() as Promise<GitPushResult>;
}

export async function gitPull(args: GitPullArgs): Promise<GitPullResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (args.authToken) headers['Authorization'] = `Bearer ${args.authToken}`;

  const res = await fetch(`${API_BASE}/agents/git/pull`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: args.provider,
      repo: args.repo,
      ref: args.ref,
      token: args.token,
      path: args.path,
      base_url: args.baseUrl,
    }),
  });
  if (!res.ok) await unwrapError(res);
  return res.json() as Promise<GitPullResult>;
}

export { GitApiError };
