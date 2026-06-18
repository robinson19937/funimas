import { describe, expect, it } from 'vitest';

import { CliApp } from '../src/cli/cli.js';

describe('CliApp', () => {
  it('ejecuta el comando protect con una ruta de proyecto', async () => {
    const app = new CliApp({
      argv: ['node', 'funimas', 'protect', '/tmp/mi-proyecto'],
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
