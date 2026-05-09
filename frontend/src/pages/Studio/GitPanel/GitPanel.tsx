import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useGraphStore } from '../../../store/graphStore';
import { gitPush, gitPull, GitApiError, type GitProvider } from '../../../api/git';

type Tab = 'push' | 'pull';
type Status = 'idle' | 'busy' | 'ok' | 'error';

interface Props {
  onClose: () => void;
}

interface ProviderState {
  token: string;
  repo: string;
  branch: string;
  baseUrl: string;
}

const STORAGE_KEY = 'studio.git.state.v1';

interface PersistedState {
  github: ProviderState;
  gitlab: ProviderState;
  activeProvider: GitProvider;
}

const DEFAULT_STATE: PersistedState = {
  github: { token: '', repo: '', branch: 'main', baseUrl: '' },
  gitlab: { token: '', repo: '', branch: 'main', baseUrl: 'https://gitlab.com' },
  activeProvider: 'github',
};

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      github: { ...DEFAULT_STATE.github, ...parsed.github },
      gitlab: { ...DEFAULT_STATE.gitlab, ...parsed.gitlab },
      activeProvider: parsed.activeProvider ?? 'github',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(s: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage may be disabled — ignore
  }
}

export function GitPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('push');
  const [persisted, setPersisted] = useState<PersistedState>(loadState);
  const [commitMessage, setCommitMessage] = useState('Update generated agent from Studio');
  const [pullPath, setPullPath] = useState('project.json');
  const [pullRef, setPullRef] = useState('main');
  const [status, setStatus] = useState<Status>('idle');
  const [resultMsg, setResultMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');

  const getProject = useGraphStore((s) => s.getProject);
  const loadProject = useGraphStore((s) => s.loadProject);
  const hasContent = useGraphStore((s) => s.nodes.length > 0 || s.edges.length > 0);

  const provider = persisted.activeProvider;
  const cfg = persisted[provider];

  useEffect(() => {
    saveState(persisted);
  }, [persisted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const updateProvider = (p: GitProvider) => {
    setPersisted({ ...persisted, activeProvider: p });
    setStatus('idle');
    setResultMsg('');
    setResultUrl('');
  };

  const updateCfg = (patch: Partial<ProviderState>) => {
    setPersisted({ ...persisted, [provider]: { ...cfg, ...patch } });
  };

  const onPush = async () => {
    if (!cfg.token || !cfg.repo) {
      setStatus('error');
      setResultMsg('Token and repo are required.');
      return;
    }
    if (!hasContent) {
      setStatus('error');
      setResultMsg('Canvas is empty. Add nodes before pushing.');
      return;
    }
    setStatus('busy');
    setResultMsg('');
    setResultUrl('');
    try {
      const result = await gitPush({
        provider,
        repo: cfg.repo,
        branch: cfg.branch || 'main',
        token: cfg.token,
        commitMessage,
        project: getProject(),
        baseUrl: provider === 'gitlab' && cfg.baseUrl ? cfg.baseUrl : undefined,
      });
      setStatus('ok');
      setResultMsg(`Committed ${result.files_committed} files (${result.commit_sha.slice(0, 7)}).`);
      setResultUrl(result.commit_url);
    } catch (e) {
      setStatus('error');
      setResultMsg(e instanceof GitApiError ? e.message : `Push failed: ${String(e)}`);
    }
  };

  const onPull = async () => {
    if (!cfg.repo) {
      setStatus('error');
      setResultMsg('Repo is required.');
      return;
    }
    if (hasContent) {
      const ok = window.confirm('Pulling will replace the current canvas. Continue?');
      if (!ok) return;
    }
    setStatus('busy');
    setResultMsg('');
    setResultUrl('');
    try {
      const result = await gitPull({
        provider,
        repo: cfg.repo,
        ref: pullRef || 'main',
        token: cfg.token,
        path: pullPath || 'project.json',
        baseUrl: provider === 'gitlab' && cfg.baseUrl ? cfg.baseUrl : undefined,
      });
      loadProject(result.project);
      setStatus('ok');
      setResultMsg(`Loaded '${result.project.name}' from ${result.repo}@${result.ref}.`);
    } catch (e) {
      setStatus('error');
      setResultMsg(e instanceof GitApiError ? e.message : `Pull failed: ${String(e)}`);
    }
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-brand focus:ring-2 focus:ring-orange-100 placeholder-gray-400';

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔀</span>
            <h2 className="text-gray-900 font-semibold text-base leading-tight">Git integration</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg" aria-label="Close">
            ✕
          </button>
        </header>

        {/* Provider switch */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => updateProvider('github')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${provider === 'github' ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'}`}
          >
            GitHub
          </button>
          <button
            onClick={() => updateProvider('gitlab')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${provider === 'gitlab' ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'}`}
          >
            GitLab
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-gray-200 bg-white">
          <button
            onClick={() => setTab('push')}
            className={`flex-1 px-4 py-2 text-sm transition-colors ${tab === 'push' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ⬆ Push generated repo
          </button>
          <button
            onClick={() => setTab('pull')}
            className={`flex-1 px-4 py-2 text-sm transition-colors ${tab === 'pull' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ⬇ Pull project.json
          </button>
        </div>

        {/* Common fields */}
        <div className="px-5 py-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Personal access token <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              className={inputCls}
              value={cfg.token}
              placeholder={provider === 'github' ? 'ghp_… (Contents:write scope)' : 'glpat-… (api scope)'}
              onChange={(e) => updateCfg({ token: e.target.value })}
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-1">
              Stored in browser localStorage only. Never sent anywhere except to the engine which forwards it to {provider === 'github' ? 'api.github.com' : 'GitLab'}.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Repo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputCls}
              value={cfg.repo}
              placeholder={provider === 'github' ? 'owner/name' : 'group/project (or nested/group/project)'}
              onChange={(e) => updateCfg({ repo: e.target.value })}
            />
          </div>

          {provider === 'gitlab' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">GitLab base URL (self-hosted only)</label>
              <input
                type="text"
                className={inputCls}
                value={cfg.baseUrl}
                placeholder="https://gitlab.com"
                onChange={(e) => updateCfg({ baseUrl: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Tab-specific fields */}
        <div className="px-5 pb-3 space-y-3 border-t border-gray-200 pt-3">
          {tab === 'push' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
                <input
                  type="text"
                  className={inputCls}
                  value={cfg.branch}
                  placeholder="main"
                  onChange={(e) => updateCfg({ branch: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">Auto-created off the default branch if missing.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Commit message</label>
                <input
                  type="text"
                  className={inputCls}
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ref (branch / tag / commit)</label>
                <input
                  type="text"
                  className={inputCls}
                  value={pullRef}
                  placeholder="main"
                  onChange={(e) => setPullRef(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Path within repo</label>
                <input
                  type="text"
                  className={inputCls}
                  value={pullPath}
                  placeholder="project.json"
                  onChange={(e) => setPullPath(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Action + status */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <div className="text-xs flex-1 min-w-0">
            {status === 'busy' && <span className="text-brand">Working…</span>}
            {status === 'ok' && (
              <span className="text-green-600">
                ✓ {resultMsg}{' '}
                {resultUrl && (
                  <a href={resultUrl} target="_blank" rel="noreferrer" className="underline hover:text-green-500 break-all">
                    view commit
                  </a>
                )}
              </span>
            )}
            {status === 'error' && <span className="text-red-500 break-words">⚠ {resultMsg}</span>}
          </div>

          <button
            onClick={tab === 'push' ? onPush : onPull}
            disabled={status === 'busy'}
            className="flex-shrink-0 px-4 py-1.5 text-sm bg-brand hover:bg-brand-dark text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            {tab === 'push' ? 'Push' : 'Pull'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
