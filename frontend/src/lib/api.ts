// Todas las rutas reales cuelgan de /api (ver server/app.ts). En dev,
// vite.config.ts la reenvía al backend — el navegador solo ve el
// origen de Vite, así la cookie httpOnly de sesión viaja sin fricción
// de CORS.
const API_BASE = '/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      // Solo con body: Fastify rechaza con 400 (FST_ERR_CTP_EMPTY_JSON_BODY)
      // una petición con Content-Type: application/json y cuerpo vacío
      // (ej. POST /auth/logout, que no manda body).
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}) as { error?: string });
    throw new ApiError(respuesta.status, cuerpo.error ?? `Error ${respuesta.status}`);
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  return respuesta.json() as Promise<T>;
}
