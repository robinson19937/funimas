import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { BackupEngine } from '../src/backup/BackupEngine.js';
import { BackupError } from '../src/backup/BackupUtils.js';
import type { OutputWriter } from '../src/utils/output.js';

class MockOutputWriter implements OutputWriter {
  readonly lines: string[] = [];

  writeln(message = ''): void {
    this.lines.push(message);
  }
}

describe('BackupEngine', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function createTempProject(structure: Record<string, string>): Promise<string> {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-project-'));
    tempDirs.push(projectDir);

    for (const [relativePath, content] of Object.entries(structure)) {
      const filePath = join(projectDir, relativePath);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, content, 'utf8');
    }

    return projectDir;
  }

  it('crea un backup completo excluyendo carpetas configuradas', async () => {
    const fixedDate = new Date(2026, 5, 18, 14, 35, 22);
    const output = new MockOutputWriter();
    const projectDir = await createTempProject({
      'package.json': '{"name":"demo"}',
      'src/index.ts': 'export {};',
      'node_modules/pkg/index.js': 'ignored',
      '.git/config': 'ignored',
      'dist/app.js': 'ignored',
      'coverage/lcov.info': 'ignored',
      '.funimas/old.txt': 'ignored',
    });

    const engine = new BackupEngine({
      output,
      now: () => fixedDate,
    });

    const result = await engine.create(projectDir);

    expect(result.backupPath).toBe(
      join(projectDir, '.funimas', 'backups', '2026-06-18_14-35-22'),
    );
    expect(result.relativeBackupPath).toBe('.funimas/backups/2026-06-18_14-35-22');
    expect(result.filesCopied).toBe(2);
    expect(result.startedAt).toEqual(fixedDate);
    expect(result.finishedAt).toEqual(fixedDate);
    expect(result.duration).toBe(0);

    await expect(readFile(join(result.backupPath, 'package.json'), 'utf8')).resolves.toBe(
      '{"name":"demo"}',
    );
    await expect(readFile(join(result.backupPath, 'src', 'index.ts'), 'utf8')).resolves.toBe(
      'export {};',
    );

    await expect(readFile(join(result.backupPath, 'node_modules', 'pkg', 'index.js'), 'utf8')).rejects
      .toThrow();
    await expect(readFile(join(result.backupPath, '.git', 'config'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(result.backupPath, 'dist', 'app.js'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(result.backupPath, 'coverage', 'lcov.info'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(result.backupPath, '.funimas', 'old.txt'), 'utf8')).rejects.toThrow();

    expect(output.lines).toEqual([
      'Creando backup...',
      '',
      '✔ Backup completado',
      '',
      'Archivos copiados: 2',
      '',
      'Destino:',
      '',
      '.funimas/backups/2026-06-18_14-35-22',
    ]);
  });

  it('reutiliza la carpeta .funimas existente', async () => {
    const projectDir = await createTempProject({
      '.funimas/config.json': '{"version":1}',
      'README.md': '# Demo',
    });

    const engine = new BackupEngine({
      output: new MockOutputWriter(),
      now: () => new Date(2026, 5, 18, 10, 0, 0),
    });

    const result = await engine.create(projectDir);

    await expect(readFile(join(projectDir, '.funimas', 'config.json'), 'utf8')).resolves.toBe(
      '{"version":1}',
    );
    await expect(readFile(join(result.backupPath, 'README.md'), 'utf8')).resolves.toBe('# Demo');
  });

  it('lanza BackupError cuando el proyecto no existe', async () => {
    const engine = new BackupEngine({ output: new MockOutputWriter() });

    await expect(engine.create('/ruta/inexistente/funimas')).rejects.toThrow(BackupError);
    await expect(engine.create('/ruta/inexistente/funimas')).rejects.toThrow(
      'El proyecto no existe:',
    );
  });
});
