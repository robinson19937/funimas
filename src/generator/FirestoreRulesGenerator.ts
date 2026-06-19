import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { GeneratedFile } from '../adapters/GeneratedFile.js';
import { RuntimeTemplateEngine } from '../runtime/RuntimeTemplateEngine.js';
import { extractFirestoreCollections } from '../utils/collection-extractor.js';
import type { GeneratorContext } from './GeneratorContext.js';
import { GeneratorFileWriter } from './GeneratorFileWriter.js';

const FIRESTORE_RULES_TEMPLATE = 'firestore/rules.hbs';
const DEFAULT_COLLECTIONS = ['clubs'];

export interface FirestoreRulesGeneratorOptions {
  fileWriter?: GeneratorFileWriter;
  templateEngine?: RuntimeTemplateEngine;
}

export interface FirestoreRulesResult {
  file: GeneratedFile;
  collections: string[];
}

/**
 * Genera firestore.rules con escrituras de cliente bloqueadas por colección detectada.
 */
export class FirestoreRulesGenerator {
  private readonly fileWriter: GeneratorFileWriter;
  private readonly templateEngine: RuntimeTemplateEngine;

  constructor(options: FirestoreRulesGeneratorOptions = {}) {
    this.fileWriter =
      options.fileWriter ?? new GeneratorFileWriter({ generatorName: 'FirestoreRulesGenerator' });
    this.templateEngine = options.templateEngine ?? new RuntimeTemplateEngine();
  }

  async generate(context: GeneratorContext): Promise<FirestoreRulesResult> {
    const collections = await this.resolveCollections(context);
    const content = await this.templateEngine.render(FIRESTORE_RULES_TEMPLATE, {
      collections,
    });

    const file: GeneratedFile = {
      fileName: 'firestore.rules',
      relativePath: 'firestore.rules',
      content: `${content}\n`,
    };

    await this.fileWriter.writeFile(context.workspacePath, file);

    return { file, collections };
  }

  private async resolveCollections(context: GeneratorContext): Promise<string[]> {
    const detected = await extractFirestoreCollections(
      context.workspacePath,
      context.semanticResult,
    );

    if (detected.length > 0) {
      return detected;
    }

    const existingRulesPath = join(context.workspacePath, 'firestore.rules');

    try {
      const existing = await readFile(existingRulesPath, 'utf8');
      const fromExisting = this.extractCollectionsFromRules(existing);

      if (fromExisting.length > 0) {
        return fromExisting;
      }
    } catch {
      // Sin reglas previas: usar colección por defecto del runtime Funimas.
    }

    return DEFAULT_COLLECTIONS;
  }

  private extractCollectionsFromRules(content: string): string[] {
    const matches = content.matchAll(/match\s+\/([a-zA-Z0-9_-]+)\/\{documentId\}/g);
    const collections = new Set<string>();

    for (const match of matches) {
      if (match[1]) {
        collections.add(match[1]);
      }
    }

    return [...collections].sort();
  }
}
