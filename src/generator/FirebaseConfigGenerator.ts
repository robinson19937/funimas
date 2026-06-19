import { access } from 'node:fs/promises';
import { join } from 'node:path';

import type { GeneratedFile } from '../adapters/GeneratedFile.js';
import type { GeneratorContext } from './GeneratorContext.js';
import { GeneratorFileWriter } from './GeneratorFileWriter.js';

export interface FirebaseConfigResult {
  files: GeneratedFile[];
}

/**
 * Genera firebase.json para desplegar reglas Firestore y Storage cuando existen.
 */
export class FirebaseConfigGenerator {
  private readonly fileWriter: GeneratorFileWriter;

  constructor(fileWriter: GeneratorFileWriter = new GeneratorFileWriter({ generatorName: 'FirebaseConfigGenerator' })) {
    this.fileWriter = fileWriter;
  }

  async generate(context: GeneratorContext): Promise<FirebaseConfigResult> {
    const config: Record<string, unknown> = {
      firestore: {
        rules: 'firestore.rules',
      },
    };

    if (await this.fileExists(context.workspacePath, 'storage.rules')) {
      config.storage = {
        rules: 'storage.rules',
      };
    }

    const firebaseJson: GeneratedFile = {
      fileName: 'firebase.json',
      relativePath: 'firebase.json',
      content: `${JSON.stringify(config, null, 2)}\n`,
    };

    await this.fileWriter.writeFile(context.workspacePath, firebaseJson);

    return { files: [firebaseJson] };
  }

  private async fileExists(workspacePath: string, relativePath: string): Promise<boolean> {
    try {
      await access(join(workspacePath, relativePath));
      return true;
    } catch {
      return false;
    }
  }
}
