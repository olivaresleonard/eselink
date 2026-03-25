import { clearStoredSession, getStoredSession, updateStoredAccessToken } from './auth';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function parseApiResponse<T>(response: Response, path: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `API request failed for ${path}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

async function refreshAccessToken() {
  const session = getStoredSession();
  if (!session?.refreshToken) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refreshToken: session.refreshToken,
    }),
  });

  if (!response.ok) {
    clearStoredSession();
    return null;
  }

  const payload = (await response.json()) as { accessToken?: string };
  if (!payload.accessToken) {
    clearStoredSession();
    return null;
  }

  updateStoredAccessToken(payload.accessToken);
  return payload.accessToken;
}

export async function requestApi<T>(
  path: string,
  init?: RequestInit,
  retryOnUnauthorized = true,
): Promise<T> {
  const session = getStoredSession();
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401 && retryOnUnauthorized && typeof window !== 'undefined') {
    const nextAccessToken = await refreshAccessToken();
    if (nextAccessToken) {
      return requestApi<T>(
        path,
        {
          ...init,
          headers: {
            ...(init?.headers ?? {}),
            Authorization: `Bearer ${nextAccessToken}`,
          },
        },
        false,
      );
    }
  }

  return parseApiResponse<T>(response, path);
}

export async function fetchApi<T>(path: string): Promise<T> {
  return requestApi<T>(path);
}

export async function postApi<T>(path: string, body?: unknown): Promise<T> {
  return requestApi<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function patchApi<T>(path: string, body?: unknown): Promise<T> {
  return requestApi<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function deleteApi<T>(path: string): Promise<T> {
  return requestApi<T>(path, {
    method: 'DELETE',
  });
}

export function formatCurrency(value: number, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
