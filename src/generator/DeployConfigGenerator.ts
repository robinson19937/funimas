import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PlatformAdapter } from '../adapters/PlatformAdapter.js';
import type { GeneratorContext } from './GeneratorContext.js';
import { EnvExampleGenerator } from './EnvExampleGenerator.js';
import { FirebaseConfigGenerator } from './FirebaseConfigGenerator.js';
import { FirestoreRulesGenerator } from './FirestoreRulesGenerator.js';
import { patchNetlifyToml } from '../utils/netlify-config-patcher.js';

export interface DeployConfigResult {
  netlifyTomlPatched: boolean;
  netlifyTomlChanges: string[];
  firestoreCollections: string[];
  filesWritten: string[];
}

/**
 * Genera y parchea toda la configuración de despliegue (Netlify, Firebase, entorno).
 */
export class DeployConfigGenerator {
  private readonly firestoreRulesGenerator: FirestoreRulesGenerator;
  private readonly firebaseConfigGenerator: FirebaseConfigGenerator;
  private readonly envExampleGenerator: EnvExampleGenerator;

  constructor(
    firestoreRulesGenerator: FirestoreRulesGenerator = new FirestoreRulesGenerator(),
    firebaseConfigGenerator: FirebaseConfigGenerator = new FirebaseConfigGenerator(),
    envExampleGenerator: EnvExampleGenerator = new EnvExampleGenerator(),
  ) {
    this.firestoreRulesGenerator = firestoreRulesGenerator;
    this.firebaseConfigGenerator = firebaseConfigGenerator;
    this.envExampleGenerator = envExampleGenerator;
  }

  async generate(context: GeneratorContext, adapter?: PlatformAdapter): Promise<DeployConfigResult> {
    const filesWritten: string[] = [];
    let netlifyTomlPatched = false;
    let netlifyTomlChanges: string[] = [];

    if (this.shouldConfigureNetlify(context, adapter)) {
      const netlifyResult = await this.patchNetlifyConfig(context.workspacePath);
      netlifyTomlPatched = netlifyResult.patched;
      netlifyTomlChanges = netlifyResult.changes;

      if (netlifyResult.patched) {
        filesWritten.push('netlify.toml');
      }
    }

    const firestoreResult = await this.firestoreRulesGenerator.generate(context);
    filesWritten.push(firestoreResult.file.relativePath);

    const firebaseResult = await this.firebaseConfigGenerator.generate(context);
    filesWritten.push(...firebaseResult.files.map((file) => file.relativePath));

    const envResult = await this.envExampleGenerator.generate(context);
    filesWritten.push(envResult.file.relativePath);

    await this.writeFunimasConfig(context.workspacePath, firestoreResult.collections);
    filesWritten.push('funimas.config.json');

    return {
      netlifyTomlPatched,
      netlifyTomlChanges,
      firestoreCollections: firestoreResult.collections,
      filesWritten,
    };
  }

  private shouldConfigureNetlify(context: GeneratorContext, adapter?: PlatformAdapter): boolean {
    if (adapter?.id === 'netlify') {
      return true;
    }

    return context.semanticResult.operations.some((operation) =>
      ['DATABASE_READ', 'DATABASE_INSERT', 'DATABASE_UPDATE', 'DATABASE_DELETE'].includes(
        operation.type,
      ),
    );
  }

  private async patchNetlifyConfig(workspacePath: string): Promise<{
    patched: boolean;
    changes: string[];
  }> {
    const netlifyTomlPath = join(workspacePath, 'netlify.toml');
    let existing = '';

    try {
      existing = await readFile(netlifyTomlPath, 'utf8');
    } catch {
      existing = '';
    }

    const patchResult = patchNetlifyToml(existing);

    if (patchResult.patched || existing.length === 0) {
      await writeFile(netlifyTomlPath, patchResult.content, 'utf8');
    }

    return {
      patched: patchResult.patched || existing.length === 0,
      changes: patchResult.changes,
    };
  }

  private async writeFunimasConfig(workspacePath: string, collections: string[]): Promise<void> {
    const configPath = join(workspacePath, 'funimas.config.json');
    const content = `${JSON.stringify(
      {
        version: 1,
        allowedCollections: collections,
      },
      null,
      2,
    )}\n`;

    await writeFile(configPath, content, 'utf8');
  }
}
