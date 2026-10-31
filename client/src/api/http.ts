import { isStaticPagesBuild } from './runtime';

let localToken: string | undefined;
let refresh: Promise<void> | undefined;

/** Hosted deployments keep their existing auth. Local mode obtains a short-lived local session. */
export async function initializeLocalSession(): Promise<void> {
  if (isStaticPagesBuild) return;
  try {
    const response = await fetch('/api/auth/local-session', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (response.ok) localToken = (await response.json()).token;
  } catch {
    // Health/status UI reports an unavailable server and allows retry.
  }
}

export async function apiFetch(input: string, options?: RequestInit): Promise<Response> {
  if (!localToken || !input.startsWith('/api/')) return options === undefined ? fetch(input) : fetch(input, options);
  const headers = new Headers(options?.headers);
  if (localToken && input.startsWith('/api/') && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${localToken}`);
  const response = await fetch(input, { ...options, headers: Object.fromEntries(headers.entries()) });
  if (response.status !== 401 || !localToken || options?.signal?.aborted) return response;
  refresh ||= initializeLocalSession().finally(() => { refresh = undefined; });
  await refresh;
  if (localToken) headers.set('Authorization', `Bearer ${localToken}`);
  return fetch(input, { ...options, headers: Object.fromEntries(headers.entries()) });
}
