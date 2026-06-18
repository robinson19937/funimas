import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { NetlifyAdapter } from '../src/adapters/netlify/NetlifyAdapter.js';
import { GeneratorContext } from '../src/generator/GeneratorContext.js';
import { WorkspaceConfigGenerator } from '../src/generator/WorkspaceConfigGenerator.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';
import { ValidationEngine } from '../src/validation/ValidationEngine.js';

describe('WorkspaceConfigGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function createPlainJsWorkspace(): Promise<string> {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-plain-js-'));
    tempDirs.push(workspacePath);

    await writeFile(
      join(workspacePath, 'document-review.js'),
      "import { addDoc, collection } from 'firebase/firestore';\n\nexport async function createReview(db) {\n  return addDoc(collection(db, 'reviews'), { status: 'pending' });\n}\n",
      'utf8',
    );
    await writeFile(
      join(workspacePath, 'netlify.toml'),
      '[build]\n  functions = "netlify/functions"\n',
      'utf8',
    );

    return workspacePath;
  }

  function createGeneratorContext(workspacePath: string): GeneratorContext {
    const semanticResult = new SemanticResult({
      operations: [],
      totalOperations: 0,
      operationsByType: createEmptyActionsByType(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    return new GeneratorContext({
      projectPath: '/tmp/original',
      workspacePath,
      semanticResult,
      adapter: new NetlifyAdapter(),
    });
  }

  it('genera tsconfig, tipos de Netlify y package.json en proyectos JS sin configuración previa', async () => {
    const workspacePath = await createPlainJsWorkspace();
    const generator = new WorkspaceConfigGenerator();

    const result = await generator.generate(createGeneratorContext(workspacePath));

    expect(result.typesRelativePath).toBe('types/netlify.d.ts');

    const tsConfig = JSON.parse(await readFile(join(workspacePath, 'tsconfig.json'), 'utf8'));
    expect(tsConfig.compilerOptions.paths['@funimas/sdk']).toEqual(['./sdk/index.ts']);
    expect(tsConfig.include).toEqual(
      expect.arrayContaining([
        '**/*.js',
        'sdk/**/*',
        'runtime/**/*',
        'netlify/**/*',
        'types/**/*',
      ]),
    );

    const packageJson = JSON.parse(await readFile(join(workspacePath, 'package.json'), 'utf8'));
    expect(packageJson.dependencies['@netlify/functions']).toBe('^2.8.2');

    const netlifyTypes = await readFile(join(workspacePath, result.typesRelativePath), 'utf8');
    expect(netlifyTypes).toContain("declare module '@netlify/functions'");
  });

  it('usa src/types cuando el proyecto ya tiene carpeta src', async () => {
    const workspacePath = await createPlainJsWorkspace();
    await mkdir(join(workspacePath, 'src'), { recursive: true });

    const generator = new WorkspaceConfigGenerator();
    const result = await generator.generate(createGeneratorContext(workspacePath));

    expect(result.typesRelativePath).toBe('src/types/netlify.d.ts');
    await expect(readFile(join(workspacePath, 'src/types/netlify.d.ts'), 'utf8')).resolves.toContain(
      "declare module '@netlify/functions'",
    );
  });

  it('fusiona tsconfig existente sin perder opciones del proyecto', async () => {
    const workspacePath = await createPlainJsWorkspace();
    await writeFile(
      join(workspacePath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            jsx: 'react-jsx',
            paths: {
              '@app/*': ['./src/*'],
            },
          },
          include: ['src/**/*'],
        },
        null,
        2,
      ),
      'utf8',
    );

    const generator = new WorkspaceConfigGenerator();
    await generator.generate(createGeneratorContext(workspacePath));

    const tsConfig = JSON.parse(await readFile(join(workspacePath, 'tsconfig.json'), 'utf8'));
    expect(tsConfig.compilerOptions.jsx).toBe('react-jsx');
    expect(tsConfig.compilerOptions.paths['@app/*']).toEqual(['./src/*']);
    expect(tsConfig.compilerOptions.paths['@funimas/sdk']).toEqual(['./sdk/index.ts']);
  });

  it('permite validar imports de @funimas/sdk tras generar el SDK', async () => {
    const workspacePath = await createPlainJsWorkspace();
    const generator = new WorkspaceConfigGenerator();
    await generator.generate(createGeneratorContext(workspacePath));

    await mkdir(join(workspacePath, 'sdk/database'), { recursive: true });
    await writeFile(
      join(workspacePath, 'sdk/index.ts'),
      "export const Funimas = { database: { insert: async () => undefined } };\n",
      'utf8',
    );
    await writeFile(
      join(workspacePath, 'document-review.js'),
      "import { Funimas } from '@funimas/sdk';\n\nexport async function createReview() {\n  return Funimas.database.insert('reviews', { status: 'pending' });\n}\n",
      'utf8',
    );

    const engine = new ValidationEngine();
    const result = await engine.validate(workspacePath);

    expect(result.errors.some((error) => error.message.includes('Import no resuelto: @funimas/sdk'))).toBe(
      false,
    );
  });
});
