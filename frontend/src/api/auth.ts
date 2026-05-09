const RAW_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';
const API_BASE = RAW_BASE.replace(/\/+$/, '');

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'viewer' | 'creator' | 'admin';
}

export interface LoginResult {
  ok: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    return { ok: false, message: data.detail || data.message || 'Login failed' };
  }

  // Normalize role to lowercase
  if (data.user?.role) {
    data.user.role = data.user.role.toLowerCase();
  }

  return data;
}

export async function getMe(token: string): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}
