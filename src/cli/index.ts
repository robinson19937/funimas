#!/usr/bin/env node

import { CliApp } from './cli.js';

async function main(): Promise<void> {
  const app = new CliApp();
  const exitCode = await app.run();
  process.exit(exitCode);
}

main().catch((error: unknown) => {
  console.error('Error inesperado:', error);
  process.exit(1);
});
