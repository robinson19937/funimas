import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { GeneratedFileVerifier } from '../generator/GeneratedFileVerifier.js';
import type { RuntimeContext } from './RuntimeContext.js';
import { RuntimeResult } from './RuntimeResult.js';
import { RuntimeTemplateEngine } from './RuntimeTemplateEngine.js';
import { VERSION } from '../utils/version.js';

export interface RuntimeFileDefinition {
  templatePath: string;
  outputPath: string;
}

export const RUNTIME_FILE_DEFINITIONS: RuntimeFileDefinition[] = [
  { templatePath: 'runtime/handler.hbs', outputPath: 'runtime/handler.ts' },
  { templatePath: 'runtime/router.hbs', outputPath: 'runtime/router.ts' },
  {
    templatePath: 'runtime/controllers/databaseController.hbs',
    outputPath: 'runtime/controllers/databaseController.ts',
  },
  {
    templatePath: 'runtime/repositories/firestoreRepository.hbs',
    outputPath: 'runtime/repositories/firestoreRepository.ts',
  },
  { templatePath: 'runtime/models/Request.hbs', outputPath: 'runtime/models/Request.ts' },
  { templatePath: 'runtime/models/Response.hbs', outputPath: 'runtime/models/Response.ts' },
];

export interface RuntimeGeneratorOptions {
  templateEngine?: RuntimeTemplateEngine;
  fileDefinitions?: RuntimeFileDefinition[];
  now?: () => Date;
  verifier?: GeneratedFileVerifier;
}

export interface RuntimeGeneratorService {
  generate(context: RuntimeContext): Promise<RuntimeResult>;
}

/**
 * Genera el backend runtime dentro del workspace usando plantillas Handlebars.
 */
export class RuntimeGenerator implements RuntimeGeneratorService {
  private readonly templateEngine: RuntimeTemplateEngine;
  private readonly fileDefinitions: RuntimeFileDefinition[];
  private readonly now: () => Date;
  private readonly verifier: GeneratedFileVerifier;

  constructor(options: RuntimeGeneratorOptions = {}) {
    this.templateEngine = options.templateEngine ?? new RuntimeTemplateEngine();
    this.fileDefinitions = options.fileDefinitions ?? RUNTIME_FILE_DEFINITIONS;
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
        'RuntimeGenerator',
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
          operation: 'GENERATE_RUNTIME',
          rewriteRule: 'RuntimeGenerator',
          before: '',
          after: content,
          generatedFiles: [definition.outputPath],
          modifiedImports: [],
          status: 'COMPLETED',
          reason: 'El runtime centraliza la lógica de acceso a datos en el servidor.',
          benefit: 'Menor exposición del backend. Centralización de la lógica. Mejor mantenibilidad.',
          riskLevel: 'LOW',
          generatedBy: 'RuntimeGenerator',
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
