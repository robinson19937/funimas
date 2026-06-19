import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { renderSdkBrowserIndex } from '../src/generator/templates/sdk/index.js';

type FetchCall = {
  url: string;
  body: unknown;
};

describe('Funimas browser SDK database helpers', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function loadBrowserSdk() {
    const tempDir = await mkdtemp(join(tmpdir(), 'funimas-browser-sdk-'));
    tempDirs.push(tempDir);
    const modulePath = join(tempDir, 'sdk.mjs');
    await writeFile(modulePath, renderSdkBrowserIndex(), 'utf8');
    return import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
  }

  it('expone helpers explícitos para create, upsert y update existing', async () => {
    const { DatabaseClient } = await loadBrowserSdk();
    const calls: FetchCall[] = [];
    const client = new DatabaseClient({
      baseUrl: '/api',
      getIdToken: async () => 'token',
      fetchFn: async (url: string, init: RequestInit) => {
        calls.push({
          url,
          body: JSON.parse(String(init.body)),
        });

        return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await client.createDocument('companies', 'acme', { ownerId: 'uid-1' });
    await client.upsertDocumentAtPath('companies', 'acme', 'settings', 'main', {
      companyId: 'acme',
    });
    await client.updateExistingDocument('companies', 'acme', { name: 'Acme' });

    expect(calls).toEqual([
      {
        url: '/api/create',
        body: { collection: 'companies', id: 'acme', data: { ownerId: 'uid-1' } },
      },
      {
        url: '/api/upsert',
        body: {
          path: ['companies', 'acme', 'settings', 'main'],
          data: { companyId: 'acme' },
        },
      },
      {
        url: '/api/update',
        body: { collection: 'companies', id: 'acme', data: { name: 'Acme' } },
      },
    ]);
  });

  it('propaga errores útiles al usar update sobre documentos inexistentes', async () => {
    const { DatabaseClient } = await loadBrowserSdk();
    const client = new DatabaseClient({
      baseUrl: '/api',
      getIdToken: async () => 'token',
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            success: false,
            message:
              'No se puede actualizar un documento inexistente ("companies/acme"). Usa set/upsert para creación inicial.',
            code: 'NOT_FOUND',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    });

    await expect(client.updateExistingDocument('companies', 'acme', { name: 'Acme' })).rejects.toMatchObject({
      message:
        'No se puede actualizar un documento inexistente ("companies/acme"). Usa set/upsert para creación inicial.',
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('solo convierte lecturas 404 en snapshots inexistentes', async () => {
    const { DatabaseClient } = await loadBrowserSdk();
    const client = new DatabaseClient({
      baseUrl: '/api',
      getIdToken: async () => 'token',
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            success: false,
            message: 'Error interno del servidor.',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    });

    await expect(client.get('companies', 'acme')).rejects.toMatchObject({
      message: 'Error interno del servidor.',
      status: 500,
    });
  });
});
