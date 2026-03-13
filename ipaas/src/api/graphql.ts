import { getExchangedToken } from '../auth/tokenExchange';

// Token provider will be set by AuthContext
let tokenProvider: (() => Promise<string>) | null = null;

export function setGraphqlTokenProvider(provider: () => Promise<string>): void {
  tokenProvider = provider;
}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!tokenProvider) {
    throw new Error('Token provider not set. Call setGraphqlTokenProvider first.');
  }

  // GraphQL API needs exchanged token with Choreo scopes
  const asgardeoToken = await tokenProvider();
  console.log('[GraphQL] Asgardeo token length:', asgardeoToken?.length || 0);
  
  const exchangedToken = await getExchangedToken(asgardeoToken);
  console.log('[GraphQL] Exchanged token length:', exchangedToken?.length || 0);
  console.log('[GraphQL] Token preview:', exchangedToken?.substring(0, 50) + '...');

  const res = await fetch(window.API_CONFIG.graphqlUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${exchangedToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  console.log('[GraphQL] Response status:', res.status, res.statusText);

  // Non-2xx HTTP responses come from the API gateway (auth, subscription, network
  // issues) — they are NOT GraphQL error envelopes. Read the body for the real message.
  if (!res.ok) {
    let gatewayMessage = `HTTP ${res.status}`;
    try {
      const errorBody = await res.json() as { message?: string; description?: string; code?: string };
      const detail = errorBody.description ?? errorBody.message;
      if (detail) gatewayMessage = `HTTP ${res.status}: ${detail}`;
      console.error('gql: gateway error', res.status, errorBody);
    } catch {
      const text = await res.text().catch(() => '');
      if (text) gatewayMessage = `HTTP ${res.status}: ${text}`;
      console.error('gql: gateway error (non-JSON)', res.status, text);
    }
    throw new Error(gatewayMessage);
  }

  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}
