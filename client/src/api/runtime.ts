export type ClientRuntimeMode = 'application' | 'static-demo';

export type ClientRuntimeConfig = Readonly<{
  mode: ClientRuntimeMode;
  publicBaseUrl: string;
  apiBaseUrl: string | null;
  backendEnabled: boolean;
}>;

type RuntimeConfigInput = {
  baseUrl: string;
  requestedMode?: string;
  publicApiBaseUrl?: string;
};

export function resolveRuntimeConfig({
  baseUrl,
  requestedMode,
  publicApiBaseUrl
}: RuntimeConfigInput): ClientRuntimeConfig {
  const normalizedMode = requestedMode?.trim();
  const mode = normalizedMode || (baseUrl === '/chatbot/' ? 'static-demo' : 'application');

  if (mode !== 'application' && mode !== 'static-demo') {
    throw new Error(`Unsupported client runtime mode: ${mode}`);
  }

  const normalizedApiBaseUrl = publicApiBaseUrl?.trim() || '';
  if (mode === 'static-demo' && normalizedApiBaseUrl) {
    throw new Error('Static demo builds cannot configure an API base URL.');
  }

  return Object.freeze({
    mode,
    publicBaseUrl: baseUrl,
    apiBaseUrl: mode === 'static-demo' ? null : normalizedApiBaseUrl,
    backendEnabled: mode === 'application'
  });
}

export const runtimeConfig = resolveRuntimeConfig({
  baseUrl: import.meta.env.BASE_URL,
  requestedMode: import.meta.env.VITE_RUNTIME_MODE,
  publicApiBaseUrl: import.meta.env.VITE_PUBLIC_API_BASE_URL
});

export const isStaticPagesBuild = runtimeConfig.mode === 'static-demo';
