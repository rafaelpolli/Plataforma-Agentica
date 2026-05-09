import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createContract } from '../../api/dcm';
import { useAuthStore } from '../../store/authStore';
import { showToast } from '../../components/shared/Toast';
import type { ContractCreateBody, PiiLevel } from '../../types/dcm';

type FieldDraft = { name: string; type: string; description: string; nullable: boolean; pii: PiiLevel; partition_key: boolean; business_key: boolean };

const EMPTY_FIELD: FieldDraft = { name: '', type: 'STRING', description: '', nullable: true, pii: 'NONE', partition_key: false, business_key: false };

export function ContractCreatePage() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', description: '', domain: '', team: '', owner: '', source_system: '', data_classification: 'INTERNAL', tags: '',
    layer: 'BRONZE' as const, bucket: '', path: '', fmt: 'PARQUET' as const, compression: 'SNAPPY' as const,
    freshness: 'daily', max_latency_minutes: 60, availability_percent: 99.9, retention_days: 365, alert_email: '',
    partition_strategy: 'DATE' as const, partition_column: 'dt', partition_format: 'YYYY-MM-DD', pruning_enabled: true,
  });
  const [fields, setFields] = useState<FieldDraft[]>([{ ...EMPTY_FIELD }]);

  const update = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const addField = () => setFields(f => [...f, { ...EMPTY_FIELD }]);
  const updateField = (i: number, key: keyof FieldDraft, value: unknown) => {
    setFields(f => f.map((fd, j) => j === i ? { ...fd, [key]: value } : fd));
  };
  const removeField = (i: number) => setFields(f => f.filter((_, j) => j !== i));

  const steps = ['Identificacao', 'Localizacao & SLA', 'Schema'];

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const body: ContractCreateBody = {
        ...form,
        fields: fields.filter(f => f.name.trim()),
      };
      const res = await createContract(token!, body);
      showToast('Contrato criado com sucesso!');
      navigate(`/contracts/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar contrato');
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.domain.trim();
    if (step === 1) return form.bucket.trim() && form.path.trim();
    return true;
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Novo Contrato</h1>
      <p className="text-sm text-gray-400 mb-6">Preencha as informacoes para criar um novo contrato de dados</p>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className={`flex items-center gap-2 ${i <= step ? '' : 'opacity-40'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? 'bg-green-500 text-white' :
                i === step ? 'bg-brand text-white' :
                'bg-gray-200 text-gray-400'
              }`}>
                {i < step ? '\u2713' : i + 1}
              </div>
              <span className={`text-sm font-semibold ${i === step ? 'text-gray-800' : 'text-gray-400'}`}>{s}</span>
            </div>
            {i < steps.length - 1 && <div className="w-12 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        )}

        {/* Step 0: Identificacao */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Nome do Contrato *</label>
                <input value={form.name} onChange={e => update('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="ex: orders_v1" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Dominio *</label>
                <input value={form.domain} onChange={e => update('domain', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="ex: sales" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Descricao</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Time</label>
                <input value={form.team} onChange={e => update('team', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Owner</label>
                <input value={form.owner} onChange={e => update('owner', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Sistema Origem</label>
                <input value={form.source_system} onChange={e => update('source_system', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Classificacao</label>
                <select value={form.data_classification} onChange={e => update('data_classification', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand">
                  {['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Tags (virgula-separado)</label>
                <input value={form.tags} onChange={e => update('tags', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="ex: pii, critical, daily" />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Localizacao & SLA */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-gray-700 border-b pb-2">Localizacao</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Camada</label>
                <select value={form.layer} onChange={e => update('layer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand">
                  {['RAW', 'BRONZE', 'SILVER', 'GOLD'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Bucket *</label>
                <input value={form.bucket} onChange={e => update('bucket', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="s3://bucket-name" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Path *</label>
                <input value={form.path} onChange={e => update('path', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="data/orders/" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Formato</label>
                <select value={form.fmt} onChange={e => update('fmt', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand">
                  {['PARQUET', 'AVRO', 'ORC', 'JSON', 'CSV', 'DELTA'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Compressao</label>
                <select value={form.compression} onChange={e => update('compression', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand">
                  {['NONE', 'SNAPPY', 'ZSTD', 'GZIP'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <h3 className="text-sm font-bold text-gray-700 border-b pb-2 pt-4">SLA</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Freshness</label>
                <select value={form.freshness} onChange={e => update('freshness', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand">
                  {['realtime', 'hourly', 'daily', 'weekly'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Latencia Max (min)</label>
                <input type="number" value={form.max_latency_minutes} onChange={e => update('max_latency_minutes', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Disponibilidade (%)</label>
                <input type="number" value={form.availability_percent} onChange={e => update('availability_percent', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Retencao (dias)</label>
                <input type="number" value={form.retention_days} onChange={e => update('retention_days', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Email de Alerta</label>
                <input value={form.alert_email} onChange={e => update('alert_email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" placeholder="alert@example.com" />
              </div>
            </div>

            <h3 className="text-sm font-bold text-gray-700 border-b pb-2 pt-4">Particionamento</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Estrategia</label>
                <select value={form.partition_strategy} onChange={e => update('partition_strategy', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand">
                  {['NONE', 'DATE', 'HOUR', 'CUSTOM'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Coluna</label>
                <input value={form.partition_column} onChange={e => update('partition_column', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Formato</label>
                <input value={form.partition_format} onChange={e => update('partition_format', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={form.pruning_enabled} onChange={e => update('pruning_enabled', e.target.checked)} />
              Pruning habilitado
            </label>
          </div>
        )}

        {/* Step 2: Schema */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">Campos (Fields)</h3>
              <button onClick={addField} className="text-xs font-semibold text-brand hover:underline">+ Adicionar Campo</button>
            </div>
            {fields.map((f, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
                <input value={f.name} onChange={e => updateField(i, 'name', e.target.value)}
                  placeholder="Nome" className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono outline-none focus:border-brand" />
                <select value={f.type} onChange={e => updateField(i, 'type', e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono outline-none focus:border-brand">
                  {['STRING', 'INTEGER', 'BIGINT', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'JSON', 'ARRAY'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <input value={f.description} onChange={e => updateField(i, 'description', e.target.value)}
                  placeholder="Descricao" className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand" />
                <select value={f.pii} onChange={e => updateField(i, 'pii', e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono outline-none focus:border-brand">
                  {['NONE', 'EMAIL', 'PHONE', 'CPF', 'CNPJ', 'ADDRESS', 'FULL_NAME'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <label className="flex items-center gap-1 text-[10px] text-gray-400 whitespace-nowrap">
                  <input type="checkbox" checked={f.nullable} onChange={e => updateField(i, 'nullable', e.target.checked)} /> Null
                </label>
                <label className="flex items-center gap-1 text-[10px] text-gray-400 whitespace-nowrap">
                  <input type="checkbox" checked={f.partition_key} onChange={e => updateField(i, 'partition_key', e.target.checked)} /> PK
                </label>
                <label className="flex items-center gap-1 text-[10px] text-gray-400 whitespace-nowrap">
                  <input type="checkbox" checked={f.business_key} onChange={e => updateField(i, 'business_key', e.target.checked)} /> BK
                </label>
                {fields.length > 1 && (
                  <button onClick={() => removeField(i)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 transition-colors"
          >
            Anterior
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/contracts')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Cancelar
            </button>
            {step < 2 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Proximo
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? 'Criando...' : 'Criar Contrato'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
