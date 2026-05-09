import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchContracts } from '../../api/dcm';
import { useAuthStore } from '../../store/authStore';
import { StatusBadge } from '../../components/shared/StatusBadge';
import type { Contract } from '../../types/dcm';

export function ContractsListPage() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const statusFilter = searchParams.get('status') || '';
  const layerFilter = searchParams.get('layer') || '';
  const query = searchParams.get('q') || '';

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchContracts(token, { status: statusFilter, layer: layerFilter, q: query })
      .then(d => setContracts(d.contracts))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, statusFilter, layerFilter, query]);

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p);
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Catalogo</h1>
          <p className="text-sm text-gray-400 mt-1">Contratos de dados registrados</p>
        </div>
        {user?.role !== 'viewer' && (
          <Link to="/contracts/new" className="btn-primary no-underline">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Novo Contrato
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" value={query}
            onChange={e => setFilter('q', e.target.value)}
            placeholder="Buscar contrato..."
            className="text-sm bg-transparent border-none outline-none text-gray-700 placeholder-gray-300 w-48"
          />
        </div>
        <div className="h-5 w-px bg-gray-200" />
        <select
          value={statusFilter}
          onChange={e => setFilter('status', e.target.value)}
          className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 outline-none"
        >
          <option value="">Todos status</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={layerFilter}
          onChange={e => setFilter('layer', e.target.value)}
          className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 outline-none"
        >
          <option value="">Todas camadas</option>
          <option value="RAW">Raw</option>
          <option value="BRONZE">Bronze</option>
          <option value="SILVER">Silver</option>
          <option value="GOLD">Gold</option>
        </select>
        {(statusFilter || layerFilter || query) && (
          <button
            onClick={() => setSearchParams({})}
            className="text-xs text-brand hover:underline ml-auto"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="ml-3 text-sm text-gray-400">Carregando...</span>
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-red-500 text-sm">{error}</div>
      ) : contracts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-gray-400 text-sm mb-2">Nenhum contrato encontrado</div>
          {user?.role !== 'viewer' && (
            <Link to="/contracts/new" className="text-brand text-sm font-semibold hover:underline">
              Criar primeiro contrato
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-5 py-3">Nome</th>
                <th className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-5 py-3">Camada</th>
                <th className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-5 py-3">Dominio</th>
                <th className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-5 py-3">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr
                  key={c.id}
                  className="border-t border-gray-50 hover:bg-[#FFF8F4] cursor-pointer transition-colors"
                  onClick={() => navigate(`/contracts/${c.id}`)}
                >
                  <td className="px-5 py-3">
                    <div className="text-sm font-semibold text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{c.id}</div>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 rounded px-2 py-0.5">{c.location.layer}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{c.domain}</td>
                  <td className="px-5 py-3 text-xs text-gray-400 font-mono">{c.updated_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
