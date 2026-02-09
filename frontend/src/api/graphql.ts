const GRAPHQL_URL = 'http://localhost:9446/graphql';

// Dev-only hardcoded token matching the backend's expected JWT format
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsICJ0eXAiOiJKV1QifQ.eyJpc3MiOiJpY3AtZnJvbnRlbmQtand0LWlzc3VlciIsICJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCAiYXVkIjoiaWNwLXNlcnZlciIsICJleHAiOjE3NzA0NTgxNjgsICJuYmYiOjE3NzA0NTQ1NjgsICJpYXQiOjE3NzA0NTQ1NjgsICJ1c2VybmFtZSI6ImFkbWluIiwgImRpc3BsYXlOYW1lIjoiU3lzdGVtIEFkbWluaXN0cmF0b3IiLCAic2NvcGUiOiJlbnZpcm9ubWVudF9tZ3Q6bWFuYWdlIGVudmlyb25tZW50X21ndDptYW5hZ2Vfbm9ucHJvZCBpbnRlZ3JhdGlvbl9tZ3Q6ZWRpdCBpbnRlZ3JhdGlvbl9tZ3Q6bWFuYWdlIGludGVncmF0aW9uX21ndDp2aWV3IG9ic2VydmFiaWxpdHlfbWd0OnZpZXdfaW5zaWdodHMgb2JzZXJ2YWJpbGl0eV9tZ3Q6dmlld19sb2dzIHByb2plY3RfbWd0OmVkaXQgcHJvamVjdF9tZ3Q6bWFuYWdlIHByb2plY3RfbWd0OnZpZXcgdXNlcl9tZ3Q6bWFuYWdlX2dyb3VwcyB1c2VyX21ndDptYW5hZ2Vfcm9sZXMgdXNlcl9tZ3Q6bWFuYWdlX3VzZXJzIHVzZXJfbWd0OnVwZGF0ZV9ncm91cF9yb2xlcyB1c2VyX21ndDp1cGRhdGVfdXNlcnMifQ.r1xPvqBtaOzS6uwj3yf7zu2OX9iB0dFmYw-vQ20iRV0';

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}
