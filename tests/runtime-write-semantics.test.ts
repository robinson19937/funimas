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

  it('documenta el fallo explícito al actualizar documentos inexistentes', async () => {
    const engine = new RuntimeTemplateEngine();
    const repository = await engine.render('runtime/repositories/firestoreRepository.hbs');

    expect(repository).toContain('DocumentNotFoundForUpdateError');
    expect(repository).toContain('No se puede actualizar un documento inexistente');
    expect(repository).toContain('Usa set/upsert para creación inicial');
    expect(repository).toContain('.set(decodeWriteData(data), { merge: true })');
  });
});
