import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  GeneratedFileVerifier,
  GenerationVerificationError,
  GeneratorFileWriter,
} from '../src/generator/index.js';
import { ProtectPipeline } from '../src/pipeline/ProtectPipeline.js';
import { GeneratorResult } from '../src/generator/GeneratorResult.js';
import { NullOutputWriter } from '../src/utils/output.js';
import type { SDKGeneratorService } from '../src/generator/SDKGenerator.js';
import type { GeneratorContext } from '../src/generator/GeneratorContext.js';

describe('GeneratedFileVerifier', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('confirma que un archivo existe en disco', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-verify-exists-'));
    tempDirs.push(workspacePath);
    const verifier = new GeneratedFileVerifier();

    await mkdir(join(workspacePath, 'sdk'), { recursive: true });
    await writeFile(join(workspacePath, 'sdk/index.ts'), 'export {}', 'utf8');

    await expect(
      verifier.verifyExists(workspacePath, 'sdk/index.ts', 'SDKGenerator'),
    ).resolves.toContain('sdk/index.ts');
  });

  it('lanza GenerationVerificationError si el archivo no existe', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-verify-missing-'));
    tempDirs.push(workspacePath);
    const verifier = new GeneratedFileVerifier();

    await expect(
      verifier.verifyExists(workspacePath, 'runtime/handler.ts', 'RuntimeGenerator'),
    ).rejects.toBeInstanceOf(GenerationVerificationError);
  });

  it('verifica que el contenido en disco coincide con el generado', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-verify-content-'));
    tempDirs.push(workspacePath);
    const verifier = new GeneratedFileVerifier();
    const relativePath = 'netlify/functions/database_insert.ts';
    const absolutePath = join(workspacePath, relativePath);
    const content = 'export const handler = () => {}';

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');

    await expect(
      verifier.verifyWrittenFile(
        workspacePath,
        { relativePath, absolutePath, content },
        'FunctionGenerator',
      ),
    ).resolves.toBeUndefined();
  });

  it('falla si el contenido en disco no coincide', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-verify-mismatch-'));
    tempDirs.push(workspacePath);
    const verifier = new GeneratedFileVerifier();
    const relativePath = 'sdk/index.ts';
    const absolutePath = join(workspacePath, relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, 'export const Funimas = {};', 'utf8');

    await expect(
      verifier.verifyWrittenFile(
        workspacePath,
        { relativePath, absolutePath, content: 'export const Other = {};' },
        'SDKGenerator',
      ),
    ).rejects.toBeInstanceOf(GenerationVerificationError);
  });
});

describe('GeneratorFileWriter verification', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('verifica en disco inmediatamente después de escribir', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-writer-verify-'));
    tempDirs.push(workspacePath);
    const writer = new GeneratorFileWriter({ generatorName: 'SDKGenerator' });

    const written = await writer.writeFile(workspacePath, {
      fileName: 'index.ts',
      relativePath: 'sdk/index.ts',
      content: 'export const Funimas = {};',
    });

    await expect(
      new GeneratedFileVerifier().verifyWrittenFile(workspacePath, written, 'SDKGenerator'),
    ).resolves.toBeUndefined();
  });
});

class BrokenSDKGenerator implements SDKGeneratorService {
  async generate(_context: GeneratorContext): Promise<GeneratorResult> {
    return new GeneratorResult({
      files: [
        {
          fileName: 'index.ts',
          relativePath: 'sdk/index.ts',
          content: 'export const Funimas = {};',
          absolutePath: '/tmp/workspace/sdk/index.ts',
        },
      ],
      runtimeGenerated: false,
      sdkGenerated: true,
      functionFileNames: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });
  }
}

describe('ProtectPipeline generation verification', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
        await rm(`${dir}_funimas`, { recursive: true, force: true });
      }),
    );
  });

  it('detiene el pipeline si un generador reporta archivos que no existen en disco', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-gen-fail-'));
    tempDirs.push(projectDir);

    const { cp } = await import('node:fs/promises');
    const { dirname, join: joinPath } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const fixturesDir = joinPath(dirname(fileURLToPath(import.meta.url)), 'fixtures');
    await cp(joinPath(fixturesDir, 'firebase-project'), projectDir, { recursive: true });

    const pipeline = new ProtectPipeline({
      projectPath: projectDir,
      output: new NullOutputWriter(),
      sdkGenerator: new BrokenSDKGenerator(),
    });

    const result = await pipeline.execute();

    expect(result.success).toBe(false);
    expect(result.generationError).toContain('SDKGenerator');
    expect(result.validationResult.valid).toBe(false);
    expect(result.validationResult.errors[0]?.ruleId).toBe('generation-verification');
  });
});
