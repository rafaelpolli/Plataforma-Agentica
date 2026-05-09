import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchRequest, approveRequest, rejectRequest, addComment } from '../../api/dcm';
import { useAuthStore } from '../../store/authStore';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { showToast } from '../../components/shared/Toast';
import type { ChangeRequest, Contract } from '../../types/dcm';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuthStore();
  const navigate = useNavigate();

  const [req, setReq] = useState<ChangeRequest | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!token || !id) return;
    fetchRequest(token, id)
      .then(d => { setReq(d.request); setContract(d.contract); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async () => {
    if (!token || !id) return;
    setSubmitting(true);
    try {
      await approveRequest(token, id);
      showToast('Solicitacao aprovada!');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao aprovar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!token || !id || !comment.trim()) return;
    setSubmitting(true);
    try {
      await rejectRequest(token, id, comment);
      showToast('Solicitacao rejeitada');
      setComment('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao rejeitar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async () => {
    if (!token || !id || !comment.trim()) return;
    setSubmitting(true);
    try {
      await addComment(token, id, comment);
      showToast('Comentario adicionado');
      setComment('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao comentar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
        <span className="ml-3 text-sm text-gray-400">Carregando solicitacao...</span>
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="card p-8 text-center">
        <div className="text-red-500 text-sm mb-2">Erro ao carregar solicitacao</div>
        <div className="text-gray-400 text-xs font-mono">{error || 'Not found'}</div>
        <Link to="/requests" className="text-brand text-sm mt-4 inline-block hover:underline">Voltar</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/requests" className="hover:text-brand transition-colors">Solicitacoes</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{req.title}</span>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main content */}
        <div className="col-span-2 space-y-5">
          {/* Request info */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900">{req.title}</h1>
              <StatusBadge status={req.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span className="text-xs text-gray-400">Tipo: </span>
                <span className="text-xs font-mono text-gray-700 bg-gray-100 rounded px-2 py-0.5">{req.type}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400">Solicitante: </span>
                <span className="text-sm text-gray-700">{req.requester_name}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400">Criado: </span>
                <span className="text-xs font-mono text-gray-600">{req.created_at}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400">Atualizado: </span>
                <span className="text-xs font-mono text-gray-600">{req.updated_at}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">Descricao</div>
              <div className="text-sm text-gray-700">{req.description}</div>
            </div>

            {/* Contract link */}
            {contract && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-gray-400">Contrato:</span>
                <Link to={`/contracts/${contract.id}`} className="text-sm font-semibold text-brand hover:underline">
                  {contract.name}
                </Link>
              </div>
            )}
          </div>

          {/* Diff viewer */}
          {req.diff && req.diff.changes.length > 0 && (
            <div className="card p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Mudancas (Diff)</h3>
              <div className="text-xs text-gray-400 mb-3">
                {req.diff.version_from ? `${req.diff.version_from} → ` : 'Nova → '}
                {req.diff.version_to}
              </div>
              <div className="space-y-2">
                {req.diff.changes.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <span className="text-xs font-mono text-gray-500 bg-gray-200 rounded px-1.5 py-0.5 shrink-0">{c.field}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-gray-300 line-through break-all">{JSON.stringify(c.from)}</div>
                      <div className="text-xs font-mono text-green-700 break-all">{JSON.stringify(c.to)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="card p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Comentarios ({req.comments?.length || 0})</h3>

            {req.comments?.length > 0 ? (
              <div className="space-y-3 mb-4">
                {req.comments.map((c, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700">{c.author}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{c.date}</span>
                    </div>
                    <div className="text-sm text-gray-600">{c.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 mb-4">Nenhum comentario ainda</div>
            )}

            {/* Add comment */}
            <div className="flex items-start gap-3">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Adicionar comentario..."
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand resize-none"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleComment}
                  disabled={submitting || !comment.trim()}
                  className="btn-primary text-xs disabled:opacity-40"
                >
                  Comentar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Actions */}
        <div>
          <div className="card p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Acoes</h3>

            {req.status === 'OPEN' && user?.role === 'admin' && (
              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition-colors disabled:opacity-40"
                >
                  {submitting ? 'Aprovando...' : 'Aprovar'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting || !comment.trim()}
                  className="w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-40"
                >
                  {submitting ? 'Rejeitando...' : 'Rejeitar'}
                </button>
                {!comment.trim() && (
                  <div className="text-[10px] text-gray-400 text-center">Adicione um comentario para rejeitar</div>
                )}
              </div>
            )}

            {req.status !== 'OPEN' && (
              <div className="text-sm text-gray-400 text-center py-4">
                Esta solicitacao ja foi {req.status === 'APPROVED' ? 'aprovada' : 'rejeitada'}.
              </div>
            )}

            {user?.role !== 'admin' && req.status === 'OPEN' && (
              <div className="text-sm text-gray-400 text-center py-4">
                Apenas administradores podem aprovar ou rejeitar.
              </div>
            )}
          </div>

          {/* Contract link card */}
          {contract && (
            <div className="card p-5 mt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Contrato</h3>
              <Link to={`/contracts/${contract.id}`} className="text-sm font-semibold text-brand hover:underline">
                {contract.name}
              </Link>
              <div className="text-xs text-gray-400 mt-1">{contract.id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
