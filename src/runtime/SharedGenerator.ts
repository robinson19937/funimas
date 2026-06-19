import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { GeneratedFileVerifier } from '../generator/GeneratedFileVerifier.js';
import type { RuntimeContext } from './RuntimeContext.js';
import { RuntimeResult } from './RuntimeResult.js';
import { RuntimeTemplateEngine } from './RuntimeTemplateEngine.js';
import { SHARED_FILE_DEFINITIONS, type RuntimeFileDefinition } from './RuntimeGenerator.js';
import { VERSION } from '../utils/version.js';

export interface SharedGeneratorOptions {
  templateEngine?: RuntimeTemplateEngine;
  fileDefinitions?: RuntimeFileDefinition[];
  now?: () => Date;
  verifier?: GeneratedFileVerifier;
}

export interface SharedGeneratorService {
  generate(context: RuntimeContext): Promise<RuntimeResult>;
}

/**
 * Genera el paquete shared/ con lógica de negocio reutilizable entre cliente y servidor.
 */
export class SharedGenerator implements SharedGeneratorService {
  private readonly templateEngine: RuntimeTemplateEngine;
  private readonly fileDefinitions: RuntimeFileDefinition[];
  private readonly now: () => Date;
  private readonly verifier: GeneratedFileVerifier;

  constructor(options: SharedGeneratorOptions = {}) {
    this.templateEngine = options.templateEngine ?? new RuntimeTemplateEngine();
    this.fileDefinitions = options.fileDefinitions ?? SHARED_FILE_DEFINITIONS;
    this.now = options.now ?? (() => new Date());
    this.verifier = options.verifier ?? new GeneratedFileVerifier();
  }

  async generate(context: RuntimeContext): Promise<RuntimeResult> {
    const startedAt = this.now();
    const workspaceRoot = resolve(context.workspacePath);
    const generatedFiles: RuntimeResult['generatedFiles'] = [];

    for (const definition of this.fileDefinitions) {
      const content = await this.templateEngine.render(definition.templatePath);
      const absolutePath = resolve(workspaceRoot, definition.outputPath);

      if (!absolutePath.startsWith(workspaceRoot)) {
        throw new Error(`No se puede escribir fuera del workspace: ${definition.outputPath}`);
      }

      await mkdir(dirname(absolutePath), { recursive: true });
      const diskContent = `${content}\n`;
      await writeFile(absolutePath, diskContent, 'utf8');

      await this.verifier.verifyWrittenFile(
        workspaceRoot,
        {
          relativePath: definition.outputPath,
          absolutePath,
          content: diskContent,
        },
        'SharedGenerator',
      );

      const fileName = definition.outputPath.split('/').pop() ?? definition.outputPath;

      generatedFiles.push({
        fileName,
        relativePath: definition.outputPath,
        absolutePath,
      });

      if (context.history) {
        await context.history.record({
          file: absolutePath,
          operation: 'GENERATE_SHARED',
          rewriteRule: 'SharedGenerator',
          before: '',
          after: content,
          generatedFiles: [definition.outputPath],
          modifiedImports: [],
          status: 'COMPLETED',
          reason: 'La lógica compartida evita duplicar reglas de autorización y mutaciones.',
          benefit: 'Consistencia entre cliente y servidor. Menor riesgo de regresiones de seguridad.',
          riskLevel: 'LOW',
          generatedBy: 'SharedGenerator',
          templateUsed: `templates/${definition.templatePath}`,
          compilerVersion: VERSION,
        });
      }
    }

    const finishedAt = this.now();

    return new RuntimeResult({
      generatedFiles,
      startedAt,
      finishedAt,
    });
  }
}
