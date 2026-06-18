import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CliApp } from '../src/cli/cli.js';

describe('CliApp', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('ejecuta el comando protect con una ruta de proyecto', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-cli-'));
    tempDirs.push(projectDir);
    await writeFile(join(projectDir, 'package.json'), '{}', 'utf8');

    const app = new CliApp({
      argv: ['node', 'funimas', 'protect', projectDir],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(0);
  });

  it('devuelve código de salida 1 cuando falta la ruta del proyecto', async () => {
    const app = new CliApp({
      argv: ['node', 'funimas', 'protect'],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(1);
  });

  it('devuelve código de salida 1 para comandos desconocidos', async () => {
    const app = new CliApp({
      argv: ['node', 'funimas', 'desconocido'],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(1);
  });

  it('devuelve código de salida 1 cuando no se proporciona ningún comando', async () => {
    const app = new CliApp({
      argv: ['node', 'funimas'],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(1);
  });
});
