import { authenticatedFetch } from '../auth/tokenManager';

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await authenticatedFetch(window.API_CONFIG.graphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GraphQL request failed (HTTP ${res.status}): ${body || res.statusText}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}
