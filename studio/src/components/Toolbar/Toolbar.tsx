import { useState, useCallback, useEffect, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { validateGraph, generateZip, checkEngineHealth } from '../../api/engine';
import { importAgentZip, ImportError } from '../../api/import';
import { HelpPanel } from '../Help/HelpPanel';
import { GitPanel } from '../GitPanel/GitPanel';

type EngineHealth = 'unknown' | 'ok' | 'down';

function HealthDot({ status, lastError }: { status: EngineHealth; lastError: string }) {
  const map: Record<EngineHealth, { cls: string; label: string; title: string }> = {
    unknown: { cls: 'bg-gray-500', label: 'Engine ?', title: 'Checking engine…' },
    ok:      { cls: 'bg-green-500', label: 'Engine', title: 'Engine reachable at /api/health' },
    down:    { cls: 'bg-red-500',   label: 'Engine offline', title: lastError || 'Engine /api/health failed' },
  };
  const { cls, label, title } = map[status];
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400" title={title}>
      <span className={`w-2 h-2 rounded-full ${cls}`} />
      <span>{label}</span>
    </div>
  );
}

type Status = 'idle' | 'validating' | 'valid' | 'invalid' | 'generating' | 'error';

function StatusBadge({ status, errorCount }: { status: Status; errorCount: number }) {
  if (status === 'idle') return null;
  const map: Record<Status, { label: string; cls: string }> = {
    idle: { label: '', cls: '' },
    validating: { label: 'Validating…', cls: 'text-blue-400' },
    generating: { label: 'Generating…', cls: 'text-blue-400' },
    valid: { label: '✓ Valid', cls: 'text-green-400' },
    invalid: { label: `✗ ${errorCount} error${errorCount !== 1 ? 's' : ''}`, cls: 'text-red-400' },
    error: { label: '⚠ Error', cls: 'text-amber-400' },
  };
  const { label, cls } = map[status];
  return <span className={`text-sm font-medium ${cls}`}>{label}</span>;
}

export function Toolbar() {
  const projectName = useGraphStore((s) => s.projectName);
  const setProjectName = useGraphStore((s) => s.setProjectName);
  const getProject = useGraphStore((s) => s.getProject);
  const loadProject = useGraphStore((s) => s.loadProject);
  const setValidationErrors = useGraphStore((s) => s.setValidationErrors);
  const clearValidation = useGraphStore((s) => s.clearValidation);
  const validationErrors = useGraphStore((s) => s.validationErrors);
  const hasContent = useGraphStore((s) => s.nodes.length > 0 || s.edges.length > 0);

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const [engineHealth, setEngineHealth] = useState<EngineHealth>('unknown');
  const [healthError, setHealthError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stopped = false;
    const ctl = new AbortController();
    const tick = async () => {
      const result = await checkEngineHealth(ctl.signal);
      if (stopped) return;
      setEngineHealth(result.ok ? 'ok' : 'down');
      setHealthError(result.error ?? '');
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => {
      stopped = true;
      window.clearInterval(id);
      ctl.abort();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (!inField && e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onValidate = useCallback(async () => {
    setStatus('validating');
    clearValidation();
    try {
      const result = await validateGraph(getProject());
      setValidationErrors(result.errors);
      setStatus(result.valid ? 'valid' : 'invalid');
    } catch (e) {
      setStatus('error');
      setErrorMsg(String(e));
    }
  }, [getProject, setValidationErrors, clearValidation]);

  const onImportClick = useCallback(() => {
    if (hasContent) {
      const ok = window.confirm(
        'Importing a ZIP will replace the current canvas. Continue?',
      );
      if (!ok) return;
    }
    fileInputRef.current?.click();
  }, [hasContent]);

  const onFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setStatus('idle');
      setErrorMsg('');
      try {
        const project = await importAgentZip(file);
        loadProject(project);
        setStatus('valid');
      } catch (err) {
        setStatus('error');
        setErrorMsg(err instanceof ImportError ? err.message : `Import failed: ${String(err)}`);
      }
    },
    [loadProject],
  );

  const onGenerate = useCallback(async () => {
    setStatus('generating');
    clearValidation();
    try {
      await generateZip(getProject());
      setStatus('valid');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('error');
      setErrorMsg(msg);
    }
  }, [getProject, clearValidation]);

  return (
    <header className="h-12 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-3 flex-shrink-0">
      {/* Logo / brand */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-lg">🤖</span>
        <span className="text-white font-semibold text-sm hidden sm:block">Agents Studio</span>
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {/* Project name */}
      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500 w-48"
        placeholder="project-name"
      />

      <div className="flex-1" />

      {/* Engine health */}
      <HealthDot status={engineHealth} lastError={healthError} />

      <div className="w-px h-6 bg-gray-700" />

      {/* Status */}
      <StatusBadge status={status} errorCount={validationErrors.length} />
      {status === 'error' && errorMsg && (
        <span className="text-xs text-amber-400 max-w-xs truncate" title={errorMsg}>
          {errorMsg}
        </span>
      )}

      <div className="w-px h-6 bg-gray-700" />

      {/* Actions */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={onFileSelected}
      />

      <button
        onClick={onImportClick}
        disabled={status === 'validating' || status === 'generating'}
        title="Import a previously generated agent ZIP and edit its graph"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 transition-colors"
      >
        <span>⬆</span> Import ZIP
      </button>

      <button
        onClick={() => setGitOpen(true)}
        disabled={status === 'validating' || status === 'generating'}
        title="Push generated repo to GitHub/GitLab, or pull project.json back"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 transition-colors"
      >
        <span>🔀</span> Git
      </button>

      <button
        onClick={onValidate}
        disabled={status === 'validating' || status === 'generating'}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 transition-colors"
      >
        <span>✓</span> Validate
      </button>

      <button
        onClick={onGenerate}
        disabled={status === 'validating' || status === 'generating'}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
      >
        <span>⬇</span> Generate ZIP
      </button>

      <button
        onClick={() => setHelpOpen(true)}
        title="Help (?)"
        aria-label="Open help"
        className="flex items-center justify-center w-8 h-8 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
      >
        ?
      </button>

      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      {gitOpen && <GitPanel onClose={() => setGitOpen(false)} />}
    </header>
  );
}
