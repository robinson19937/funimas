import { describe, expect, it } from 'vitest';

import { patchNetlifyToml } from '../src/utils/netlify-config-patcher.js';

describe('patchNetlifyToml', () => {
  it('añade redirects y configuración de functions a un netlify.toml mínimo', () => {
    const input = '[build]\n  functions = "netlify/functions"\n';
    const result = patchNetlifyToml(input);

    expect(result.patched).toBe(true);
    expect(result.content).toContain('from = "/api/*"');
    expect(result.content).toContain('to = "/.netlify/functions/funimas/:splat"');
    expect(result.content).toContain('node_bundler = "esbuild"');
    expect(result.content).toContain('external_node_modules = ["firebase-admin"]');
  });

  it('no modifica un netlify.toml ya configurado para Funimas', () => {
    const input = `[build]
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/funimas/:splat"
  status = 200

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["firebase-admin"]
`;

    const result = patchNetlifyToml(input);

    expect(result.patched).toBe(false);
    expect(result.changes).toEqual([]);
  });

  it('crea configuración completa desde un archivo vacío', () => {
    const result = patchNetlifyToml('');

    expect(result.patched).toBe(true);
    expect(result.content).toContain('[build]');
    expect(result.content).toContain('functions = "netlify/functions"');
    expect(result.content).toContain('publish = "."');
  });
});
