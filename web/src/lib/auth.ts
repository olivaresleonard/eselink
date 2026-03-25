export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    workspaceId?: string;
  };
};

const AUTH_STORAGE_KEY = 'eselink:auth-session';

export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('eselink-auth-changed'));
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event('eselink-auth-changed'));
}

export function updateStoredAccessToken(accessToken: string) {
  const current = getStoredSession();
  if (!current) {
    return;
  }

  setStoredSession({
    ...current,
    accessToken,
  });
}

