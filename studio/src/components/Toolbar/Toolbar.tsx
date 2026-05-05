import { useState, useCallback } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { validateGraph, generateZip } from '../../api/engine';

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
  const setValidationErrors = useGraphStore((s) => s.setValidationErrors);
  const clearValidation = useGraphStore((s) => s.clearValidation);
  const validationErrors = useGraphStore((s) => s.validationErrors);

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

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

      {/* Status */}
      <StatusBadge status={status} errorCount={validationErrors.length} />
      {status === 'error' && errorMsg && (
        <span className="text-xs text-amber-400 max-w-xs truncate" title={errorMsg}>
          {errorMsg}
        </span>
      )}

      <div className="w-px h-6 bg-gray-700" />

      {/* Actions */}
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
    </header>
  );
}
