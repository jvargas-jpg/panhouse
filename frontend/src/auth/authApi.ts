import { apiFetch } from '../lib/api';
import type { Usuario } from '../types/api';

export function fetchMe() {
  return apiFetch<{ user: Usuario }>('/auth/me');
}

export function login(email: string, password: string) {
  return apiFetch<{ user: Usuario }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' });
}
