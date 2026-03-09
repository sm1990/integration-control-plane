/**
 * Minimal token manager for the iPaaS version.
 * Token lifecycle (storage, refresh, PKCE) is handled by @asgardeo/auth-react.
 * This module only provides:
 *   - setTokenProvider  — wired by AuthContext so authenticatedFetch can get a token
 *   - setOnAuthFailure  — wired by AuthContext to redirect on 401
 *   - authenticatedFetch — used by graphql.ts, auth.ts, logs.ts
 */

let tokenProvider: (() => Promise<string>) | null = null;
let onAuthFailure: (() => void) | null = null;

export function setTokenProvider(fn: () => Promise<string>): void {
  tokenProvider = fn;
}

export function setOnAuthFailure(callback: () => void): void {
  onAuthFailure = callback;
}

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  if (tokenProvider) {
    try {
      const token = await tokenProvider();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // token unavailable — proceed without Authorization header; server will 401
    }
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    onAuthFailure?.();
  }

  return res;
}
