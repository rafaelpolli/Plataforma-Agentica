import { useState, useCallback, useEffect, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { validateGraph, generateZip, checkEngineHealth } from '../../api/engine';
import { importAgentZip, ImportError } from '../../api/import';
import { HelpPanel } from '../Help/HelpPanel';
import { GitPanel } from '../GitPanel/GitPanel';

type EngineHealth = 'unknown' | 'ok' | 'down';

function HealthDot({ status, lastError }: { status: EngineHealth; lastError: string }) {
  const map: Record<EngineHealth, { cls: string; label: string; title: string }> = {
    unknown: { cls: 'bg-gray-400', label: 'Engine ?', title: 'Checking engine…' },
    ok:      { cls: 'bg-green-500', label: 'Engine', title: 'Engine reachable' },
    down:    { cls: 'bg-red-500',   label: 'Engine offline', title: lastError || 'Engine /health failed' },
  };
  const { cls, label, title } = map[status];
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500" title={title}>
      <span className={`w-2 h-2 rounded-full ${cls}`} />
      <span>{label}</span>
    </div>
  );
}

type Status = 'idle' | 'validating' | 'valid' | 'invalid' | 'generating' | 'error';

function StatusBadge({ status, errorCount }: { status: Status; errorCount: number }) {
  if (status === 'idle') return null;
  const map: Record<Status, { label: string; cls: string }> = {
    idle:       { label: '', cls: '' },
    validating: { label: 'Validando…',  cls: 'text-blue-500' },
    generating: { label: 'Gerando…',    cls: 'text-blue-500' },
    valid:      { label: '✓ Válido',    cls: 'text-green-600' },
    invalid:    { label: `✗ ${errorCount} erro${errorCount !== 1 ? 's' : ''}`, cls: 'text-red-500' },
    error:      { label: '⚠ Erro',      cls: 'text-amber-600' },
  };
  const { label, cls } = map[status];
  return <span className={`text-sm font-medium ${cls}`}>{label}</span>;
}

const BTN_BASE = 'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 transition-colors font-medium';
const BTN_SECONDARY = `${BTN_BASE} bg-gray-100 hover:bg-gray-200 text-gray-700`;

export function Toolbar() {
  const projectName     = useGraphStore((s) => s.projectName);
  const setProjectName  = useGraphStore((s) => s.setProjectName);
  const getProject      = useGraphStore((s) => s.getProject);
  const loadProject     = useGraphStore((s) => s.loadProject);
  const setValidationErrors = useGraphStore((s) => s.setValidationErrors);
  const clearValidation = useGraphStore((s) => s.clearValidation);
  const validationErrors = useGraphStore((s) => s.validationErrors);
  const hasContent      = useGraphStore((s) => s.nodes.length > 0 || s.edges.length > 0);

  const [status, setStatus]           = useState<Status>('idle');
  const [errorMsg, setErrorMsg]       = useState('');
  const [helpOpen, setHelpOpen]       = useState(false);
  const [gitOpen, setGitOpen]         = useState(false);
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
    return () => { stopped = true; window.clearInterval(id); ctl.abort(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (!inField && e.key === '?') { e.preventDefault(); setHelpOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onValidate = useCallback(async () => {
    setStatus('validating'); clearValidation();
    try {
      const result = await validateGraph(getProject());
      setValidationErrors(result.errors);
      setStatus(result.valid ? 'valid' : 'invalid');
    } catch (e) { setStatus('error'); setErrorMsg(String(e)); }
  }, [getProject, setValidationErrors, clearValidation]);

  const onImportClick = useCallback(() => {
    if (hasContent && !window.confirm('Importing a ZIP will replace the current canvas. Continue?')) return;
    fileInputRef.current?.click();
  }, [hasContent]);

  const onFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus('idle'); setErrorMsg('');
    try {
      const project = await importAgentZip(file);
      loadProject(project);
      setStatus('valid');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof ImportError ? err.message : `Import failed: ${String(err)}`);
    }
  }, [loadProject]);

  const onGenerate = useCallback(async () => {
    setStatus('generating'); clearValidation();
    try {
      await generateZip(getProject());
      setStatus('valid');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('error'); setErrorMsg(msg);
    }
  }, [getProject, clearValidation]);

  const disabled = status === 'validating' || status === 'generating';

  return (
    <header
      className="h-14 relative border-b flex items-center px-5 gap-3 flex-shrink-0"
      style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)', borderColor: 'rgba(0,0,0,0.07)' }}
    >
      {/* Animated brand stripe */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: '2.5px',
          background: 'linear-gradient(90deg, #FF6200, #FFB347, #185FA5, #FF6200)',
          backgroundSize: '300% 100%',
          animation: 'stripe 6s linear infinite',
        }}
      />

      {/* JaguarData brand */}
      <div className="flex items-center gap-2.5 shrink-0 mr-1">
        <div className="leading-none">
          <div
            className="text-sm font-extrabold tracking-tight font-mono"
            style={{ background: 'linear-gradient(135deg,#FF6200,#cc4e00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            JaguarData
          </div>
          <div className="text-[10px] text-gray-400 font-mono">Agents Studio</div>
        </div>
      </div>

      <div className="h-5 w-px bg-gray-200 shrink-0" />

      {/* Project name */}
      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 text-sm text-gray-700 focus:outline-none w-48"
        style={{ '--tw-ring-color': '#FF6200' } as React.CSSProperties}
        onFocus={(e) => { e.target.style.borderColor = '#FF6200'; }}
        onBlur={(e) => { e.target.style.borderColor = ''; }}
        placeholder="project-name"
      />

      <div className="flex-1" />

      <HealthDot status={engineHealth} lastError={healthError} />

      <div className="h-5 w-px bg-gray-200 shrink-0" />

      <StatusBadge status={status} errorCount={validationErrors.length} />
      {status === 'error' && errorMsg && (
        <span className="text-xs text-amber-600 max-w-xs truncate" title={errorMsg}>{errorMsg}</span>
      )}

      <div className="h-5 w-px bg-gray-200 shrink-0" />

      <input ref={fileInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={onFileSelected} />

      <button onClick={onImportClick} disabled={disabled} title="Import a previously generated agent ZIP" className={BTN_SECONDARY}>
        <span>⬆</span> Import ZIP
      </button>

      <button onClick={() => setGitOpen(true)} disabled={disabled} title="Push/pull GitHub or GitLab" className={BTN_SECONDARY}>
        <span>🔀</span> Git
      </button>

      <button onClick={onValidate} disabled={disabled} className={BTN_SECONDARY}>
        <span>✓</span> Validar
      </button>

      <button
        onClick={onGenerate}
        disabled={disabled}
        className={`${BTN_BASE} text-white`}
        style={{ background: 'linear-gradient(135deg,#FF6200,#E05200)', boxShadow: '0 2px 8px rgba(255,98,0,.25)' }}
      >
        <span>⬇</span> Gerar ZIP
      </button>

      <button
        onClick={() => setHelpOpen(true)}
        title="Ajuda (?)"
        aria-label="Open help"
        className="flex items-center justify-center w-8 h-8 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors font-semibold"
      >
        ?
      </button>

      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      {gitOpen && <GitPanel onClose={() => setGitOpen(false)} />}
    </header>
  );
}
