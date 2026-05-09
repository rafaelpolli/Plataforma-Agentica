import { create } from 'zustand';
import type { User } from '../api/auth';
import { login as apiLogin, getMe } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('jwt_token'),
  loading: !!localStorage.getItem('jwt_token'),
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    const result = await apiLogin(username, password);
    if (result.ok && result.token && result.user) {
      localStorage.setItem('jwt_token', result.token);
      set({ user: result.user, token: result.token, loading: false, error: null });
      return true;
    }
    set({ loading: false, error: result.message || 'Login failed' });
    return false;
  },

  logout: () => {
    localStorage.removeItem('jwt_token');
    set({ user: null, token: null, error: null });
  },

  restoreSession: async () => {
    const token = get().token;
    if (!token) {
      set({ loading: false, user: null });
      return;
    }
    const user = await getMe(token);
    if (user) {
      set({ user, loading: false });
    } else {
      localStorage.removeItem('jwt_token');
      set({ user: null, token: null, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
