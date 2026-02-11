import { getToken } from '../auth/AuthContext';

const GRAPHQL_URL = 'https://localhost:9446/graphql';

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = getToken();
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}
