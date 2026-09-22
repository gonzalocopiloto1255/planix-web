import { sesionSchema, type Sesion } from '@planix/shared-types';
import { useAuth } from '../stores/auth';

/** Error de API con status y mensaje legible para mostrar en la UI. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function extraerMensaje(res: Response): Promise<string> {
  try {
    // `message` es el formato de Nest; `mensaje` el del bloqueo por
    // suscripción (402), que además trae la acción sugerida (S21).
    const body = (await res.json()) as {
      message?: string | string[];
      mensaje?: string;
    };
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;
    return msg ?? body.mensaje ?? `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}

/** Intenta renovar la sesión con la cookie httpOnly. null si no hay sesión válida. */
export async function intentarRefresh(): Promise<Sesion | null> {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    return null;
  }
  const sesion = sesionSchema.parse(await res.json());
  useAuth.getState().setSesion(sesion);
  return sesion;
}

/**
 * Cliente de la API: agrega el Bearer token de la sesión en memoria y,
 * ante un 401, intenta UN refresh (rotación) y reintenta la request.
 * Si el refresh también falla, limpia la sesión (el guard redirige a /login).
 */
export async function api(
  ruta: string,
  init: RequestInit = {},
): Promise<Response> {
  const ejecutar = (token: string | undefined) =>
    fetch(`/api${ruta}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await ejecutar(useAuth.getState().sesion?.accessToken);

  if (res.status === 401) {
    const renovada = await intentarRefresh();
    if (!renovada) {
      useAuth.getState().limpiar();
      throw new ApiError(401, 'Tu sesión expiró, inicia sesión de nuevo');
    }
    res = await ejecutar(renovada.accessToken);
  }

  if (!res.ok) {
    throw new ApiError(res.status, await extraerMensaje(res));
  }
  return res;
}

export async function apiJson<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await api(ruta, init);
  return (await res.json()) as T;
}

export async function cerrarSesion(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    useAuth.getState().limpiar();
  }
}
