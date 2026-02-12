import { authenticatedFetch } from '../auth/tokenManager';

const GRAPHQL_URL = 'https://localhost:9446/graphql';

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await authenticatedFetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}
