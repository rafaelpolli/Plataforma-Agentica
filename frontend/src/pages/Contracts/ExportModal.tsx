import { useState } from 'react';
import { exportContract } from '../../api/dcm';
import type { Contract, ExportResponse } from '../../types/dcm';
import { showToast } from '../../components/shared/Toast';

interface Props {
  contract: Contract;
  token: string;
  onClose: () => void;
}

export function ExportModal({ contract, token, onClose }: Props) {
  const [format, setFormat] = useState<'json' | 'yaml' | 'ddl'>('json');
  const [content, setContent] = useState('');
  const [lang, setLang] = useState('json');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    setLoading(true);
    setError('');
    try {
      const data: ExportResponse = await exportContract(token, contract.id, format);
      setContent(data.content);
      setLang(data.lang);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    showToast('Copiado para a area de transferencia!');
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contract.name}.${format === 'ddl' ? 'sql' : format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Exportar Contrato</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-semibold text-gray-700">Formato:</span>
            {(['json', 'yaml', 'ddl'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setFormat(f); setContent(''); }}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                  format === f
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
            <button
              onClick={handleExport}
              disabled={loading}
              className="ml-auto btn-primary text-xs"
            >
              {loading ? 'Exportando...' : 'Exportar'}
            </button>
          </div>

          {error && <div className="text-xs text-red-500 mb-3">{error}</div>}

          {content && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{lang}</span>
                <button onClick={handleCopy} className="text-xs text-gray-400 hover:text-brand transition-colors">
                  Copiar
                </button>
              </div>
              <pre className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-700 overflow-auto max-h-[400px] whitespace-pre-wrap">
                {content}
              </pre>
              <div className="mt-3 text-right">
                <button onClick={handleDownload} className="btn-primary text-xs">
                  Download
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
