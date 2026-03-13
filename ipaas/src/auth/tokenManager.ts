/**
 * Minimal token manager for the iPaaS version.
 * Token lifecycle (storage, refresh, PKCE) is handled by @asgardeo/auth-react.
 * This module only provides:
 *   - setTokenProvider  — wired by AuthContext so authenticatedFetch can get a token
 *   - setOnAuthFailure  — wired by AuthContext; called explicitly by consumers that
 *                         confirm the session is invalid (e.g. token refresh failure)
 *   - authenticatedFetch — used by graphql.ts, auth.ts, logs.ts
 *
 * NOTE: authenticatedFetch does NOT auto-redirect on 401. A 401 from a data API
 * can mean "app not subscribed" or "permission denied", not just "token expired".
 * Callers decide how to handle 401; see gql.ts for the GraphQL layer's handling.
 */

let tokenProvider: (() => Promise<string>) | null = null;
let onAuthFailure: (() => void) | null = null;

/** Decodes the payload of a JWT (no signature validation — for diagnostics only). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function setTokenProvider(fn: () => Promise<string>): void {
  tokenProvider = fn;
}

export function setOnAuthFailure(callback: () => void): void {
  onAuthFailure = callback;
}

/** Call this when a token-refresh/session-check explicitly confirms the session is gone. */
export function triggerAuthFailure(): void {
  onAuthFailure?.();
}

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  let tokenAttached = false;

  if (tokenProvider) {
    try {
      const token = await tokenProvider();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
        tokenAttached = true;

        // Diagnostics: log key JWT claims so we can debug audience / expiry issues.
        const claims = decodeJwtPayload(token);
        if (claims) {
          const exp = typeof claims.exp === 'number' ? new Date(claims.exp * 1000).toISOString() : claims.exp;
          console.debug('authenticatedFetch: token claims →', {
            iss: claims.iss,
            aud: claims.aud,
            sub: claims.sub,
            scope: claims.scope,
            exp,
            url,
          });
        }
      } else {
        console.warn('authenticatedFetch: getAccessToken() returned empty — proceeding without Authorization header', url);
      }
    } catch (err) {
      console.error('authenticatedFetch: failed to get access token:', err);
    }
  } else {
    console.warn('authenticatedFetch: tokenProvider not set yet — proceeding without Authorization header', url);
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Clone so the body can still be read by the caller.
    const cloned = res.clone();
    cloned.text().then((body) => {
      console.error(
        `authenticatedFetch: 401 Unauthorized${tokenAttached ? ' (token WAS attached)' : ' (no token)'}`,
        url,
        '\nResponse body:', body,
      );
    }).catch(() => undefined);
  }

  // Return the response as-is. Callers (e.g. gql.ts) decide whether to
  // throw, retry, or surface the error in the UI. DO NOT redirect here —
  // that would cause a login loop when the API itself (not the session) rejects the request.
  return res;
}
