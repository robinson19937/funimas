import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AstParser } from '../src/parser/AstParser.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sampleProjectPath = join(fixturesDir, 'sample-project');
const plainProjectPath = join(fixturesDir, 'plain-project');

describe('AstParser', () => {
  it('carga un proyecto con tsconfig y construye el modelo AST', async () => {
    const fixedDate = new Date(2026, 5, 18, 14, 35, 22);
    const parser = new AstParser({
      now: () => fixedDate,
    });

    const result = await parser.parse(sampleProjectPath);
    const { project } = result;

    expect(project.projectPath).toBe(sampleProjectPath);
    expect(project.totalFiles).toBe(6);
    expect(project.totalTypescriptFiles).toBe(5);
    expect(project.totalJavascriptFiles).toBe(1);
    expect(result.startedAt).toEqual(fixedDate);
    expect(result.finishedAt).toEqual(fixedDate);
    expect(result.duration).toBe(0);

    const appFile = project.sourceFiles.find((file) => file.name === 'app.ts');
    const userServiceFile = project.sourceFiles.find((file) => file.name === 'user-service.ts');
    const indexFile = project.sourceFiles.find((file) => file.name === 'index.js');

    expect(appFile).toMatchObject({
      extension: '.ts',
      importCount: 1,
      functionCount: 2,
      classCount: 1,
    });
    expect(userServiceFile).toMatchObject({
      extension: '.ts',
      importCount: 0,
      functionCount: 1,
      classCount: 1,
    });
    expect(indexFile).toMatchObject({
      extension: '.js',
      importCount: 1,
      functionCount: 1,
      classCount: 0,
    });

    expect(project.sourceFiles.some((file) => file.path.includes('node_modules'))).toBe(false);
    expect(project.sourceFiles.some((file) => file.path.includes('dist'))).toBe(false);
  });

  it('carga manualmente archivos cuando no existe tsconfig.json', async () => {
    const parser = new AstParser();
    const result = await parser.parse(plainProjectPath);
    const { project } = result;

    expect(project.totalFiles).toBe(2);
    expect(project.totalTypescriptFiles).toBe(1);
    expect(project.totalJavascriptFiles).toBe(1);
    expect(project.sourceFiles.map((file) => file.name).sort()).toEqual(['greet.js', 'greet.ts']);
  });

  it('lanza error cuando el proyecto no existe', async () => {
    const parser = new AstParser();

    await expect(parser.parse('/ruta/inexistente/funimas')).rejects.toThrow(
      'El proyecto no existe:',
    );
  });
});
