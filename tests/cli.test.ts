import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CliApp } from '../src/cli/cli.js';

describe('CliApp', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
        await rm(`${dir}_funimas`, { recursive: true, force: true });
      }),
    );
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

  it('devuelve código de salida 1 cuando la ruta del proyecto no existe', async () => {
    const app = new CliApp({
      argv: ['node', 'funimas', 'protect', '/ruta/inexistente/funimas'],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(1);
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

  it('ejecuta el comando setup', async () => {
    const app = new CliApp({
      argv: ['node', 'funimas', 'setup'],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(0);
  });

  it('ejecuta deploy en dry-run cuando el workspace existe', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'funimas-cli-deploy-'));
    const workspace = `${workspacePath}_funimas`;
    tempDirs.push(workspace);
    await mkdir(workspace, { recursive: true });

    await writeFile(
      join(workspace, 'firebase.json'),
      JSON.stringify({ firestore: { rules: 'firestore.rules' } }),
      'utf8',
    );
    await writeFile(join(workspace, 'firestore.rules'), "allow read: if false;\n", 'utf8');

    const app = new CliApp({
      argv: ['node', 'funimas', 'deploy', workspace, '--dry-run'],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(0);
  });

  it('ejecuta deploy en dry-run cuando el workspace no usa sufijo _funimas', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'funimas-cloned-workspace-'));
    tempDirs.push(workspace);

    await writeFile(
      join(workspace, 'firebase.json'),
      JSON.stringify({ firestore: { rules: 'firestore.rules' } }),
      'utf8',
    );
    await writeFile(join(workspace, 'firestore.rules'), "allow read: if false;\n", 'utf8');
    await writeFile(
      join(workspace, 'funimas.config.json'),
      JSON.stringify({ version: 1, allowedCollections: ['users'] }),
      'utf8',
    );

    const app = new CliApp({
      argv: ['node', 'funimas', 'deploy', workspace, '--dry-run'],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(0);
  });
});
