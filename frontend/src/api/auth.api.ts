import { http } from './http';

export async function login(email: string, password: string, tenantSlug: string) {
  const res = await http.post('/v1/auth/login', { email, password, tenantSlug });
  return res.data.data;
}

export async function fetchMe() {
  const res = await http.get('/v1/auth/me');
  return res.data.data;
}

export async function fetchSeasons() {
  const res = await http.get('/v1/seasons');
  return res.data.data as Array<{ id: string; year: number; season_label: string; tab: string; status: string }>;
}
