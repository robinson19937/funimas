import type { GeneratedFile } from '../adapters/GeneratedFile.js';
import type { GeneratorContext } from './GeneratorContext.js';
import { GeneratorFileWriter } from './GeneratorFileWriter.js';

export interface FirebaseConfigResult {
  files: GeneratedFile[];
}

/**
 * Genera firebase.json para desplegar reglas con `firebase deploy --only firestore:rules`.
 */
export class FirebaseConfigGenerator {
  private readonly fileWriter: GeneratorFileWriter;

  constructor(fileWriter: GeneratorFileWriter = new GeneratorFileWriter({ generatorName: 'FirebaseConfigGenerator' })) {
    this.fileWriter = fileWriter;
  }

  async generate(context: GeneratorContext): Promise<FirebaseConfigResult> {
    const firebaseJson: GeneratedFile = {
      fileName: 'firebase.json',
      relativePath: 'firebase.json',
      content: `${JSON.stringify(
        {
          firestore: {
            rules: 'firestore.rules',
          },
        },
        null,
        2,
      )}\n`,
    };

    await this.fileWriter.writeFile(context.workspacePath, firebaseJson);

    return { files: [firebaseJson] };
  }
}
