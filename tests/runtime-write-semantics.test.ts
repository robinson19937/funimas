import { describe, expect, it } from 'vitest';

import { RuntimeTemplateEngine } from '../src/runtime/RuntimeTemplateEngine.js';

describe('runtime write semantics', () => {
  it('renderiza endpoints separados para create, set, upsert y update', async () => {
    const engine = new RuntimeTemplateEngine();
    const router = await engine.render('runtime/router.hbs', {
      collections: ['companies', 'users', 'cotizaciones', 'recibos', 'notas', 'varios'],
    });

    expect(router).toContain("path === '/api/create'");
    expect(router).toContain("path === '/api/set'");
    expect(router).toContain("path === '/api/upsert'");
    expect(router).toContain("path === '/api/update'");
    expect(router).toContain('createDocumentByPath');
    expect(router).toContain('setDocumentByPath');
    expect(router).toContain('upsertDocumentByPath');
    expect(router).toContain('updateDocumentByPath');
  });

  it('no deja que las rutas de clubs capturen /api/read ni /api/list genéricos', async () => {
    const engine = new RuntimeTemplateEngine();
    const router = await engine.render('runtime/router.hbs', {
      collections: ['companies', 'users', 'cotizaciones'],
    });

    expect(router).toContain("path.startsWith('/api/clubs/') && path.endsWith('/read')");
    expect(router).toContain("path.startsWith('/api/clubs/') && path.endsWith('/mutate')");
    expect(router).toContain("path === '/api/read'");
    expect(router).toContain("path === '/api/list'");
  });

  it('documenta el fallo explícito al actualizar documentos inexistentes', async () => {
    const engine = new RuntimeTemplateEngine();
    const repository = await engine.render('runtime/repositories/firestoreRepository.hbs');

    expect(repository).toContain('DocumentNotFoundForUpdateError');
    expect(repository).toContain('No se puede actualizar un documento inexistente');
    expect(repository).toContain('Usa set/upsert para creación inicial');
    expect(repository).toContain('.set(decodeWriteData(data), { merge: true })');
  });

  it('lee todos los upserts antes de escribir en mutaciones de dominio', async () => {
    const engine = new RuntimeTemplateEngine();
    const repository = await engine.render('runtime/repositories/firestoreRepository.hbs');

    expect(repository).toContain('const upsertSnapshots = new Map');
    expect(repository).toContain('upsertSnapshots.set(path, await transaction.get(ref))');
    expect(repository).toContain('await this.applyDomainWrite(transaction, write, params, upsertSnapshots)');
    expect(repository).toContain('const snapshot = upsertSnapshots.get(path)');
  });
});
