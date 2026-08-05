import { describe, expect, it } from 'vitest';
import { resolveRuntimeConfig } from './runtime';

describe('resolveRuntimeConfig', () => {
  it('defaults the GitHub Pages base path to a backend-disabled static demo', () => {
    expect(resolveRuntimeConfig({ baseUrl: '/chatbot/' })).toEqual({
      mode: 'static-demo',
      publicBaseUrl: '/chatbot/',
      apiBaseUrl: null,
      backendEnabled: false
    });
  });

  it('keeps the normal application runtime backend-enabled', () => {
    expect(resolveRuntimeConfig({
      baseUrl: '/',
      requestedMode: 'application',
      publicApiBaseUrl: 'https://api.example.test'
    })).toEqual({
      mode: 'application',
      publicBaseUrl: '/',
      apiBaseUrl: 'https://api.example.test',
      backendEnabled: true
    });
  });

  it('rejects API configuration for a static demo', () => {
    expect(() => resolveRuntimeConfig({
      baseUrl: '/chatbot/',
      requestedMode: 'static-demo',
      publicApiBaseUrl: 'https://api.example.test'
    })).toThrow('Static demo builds cannot configure an API base URL.');
  });

  it('rejects unknown runtime modes', () => {
    expect(() => resolveRuntimeConfig({
      baseUrl: '/',
      requestedMode: 'production-ish'
    })).toThrow('Unsupported client runtime mode');
  });
});
