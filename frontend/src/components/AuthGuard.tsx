import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  children: React.ReactNode;
}

export function AuthGuard({ children }: Props) {
  const { user, loading, restoreSession } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!user && loading) {
      restoreSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <div className="text-sm text-gray-400">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!user && !loading) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
