const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/v1';

function getToken() {
  return sessionStorage.getItem('admin_token');
}

export function setToken(token: string) {
  sessionStorage.setItem('admin_token', token);
}

export function clearToken() {
  sessionStorage.removeItem('admin_token');
}

export async function adminFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
