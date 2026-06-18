import { join } from 'node:path';

import type { PlatformAdapter } from '../../adapters/PlatformAdapter.js';
import type { GeneratedFile } from '../../adapters/GeneratedFile.js';
import type { SemanticOperation } from '../../semantic/SemanticOperation.js';
import { operationTypeToFileName } from '../../utils/operation-naming.js';
import { VERSION } from '../../utils/version.js';
import { RuntimeTemplateEngine } from '../../runtime/RuntimeTemplateEngine.js';
import { TransformationBenefit } from '../../report/TransformationBenefit.js';
import { TransformationReason } from '../../report/TransformationReason.js';
import type { RiskLevel } from '../../report/RiskLevel.js';
import { GeneratorFileWriter } from '../GeneratorFileWriter.js';
import type { GeneratorContext } from '../GeneratorContext.js';

const TEMPLATE_PATH = 'netlify/databaseInsert.hbs';
const NETLIFY_FUNCTIONS_DIR = 'netlify/functions';
const GENERATED_BY = 'DatabaseInsertFunctionGenerator';

export interface DatabaseInsertFunctionMetadata {
  reason: string;
  benefit: string;
  riskLevel: RiskLevel;
  generatedBy: string;
  generatedAt: Date;
  templateUsed: string;
  compilerVersion: string;
  relatedGeneratedFiles: string[];
}

export interface DatabaseInsertFunctionResult {
  file: GeneratedFile & { absolutePath: string };
  metadata: DatabaseInsertFunctionMetadata;
}

export interface DatabaseInsertFunctionGeneratorOptions {
  templateEngine?: RuntimeTemplateEngine;
  fileWriter?: GeneratorFileWriter;
  now?: () => Date;
}

export interface DatabaseInsertFunctionGeneratorService {
  generate(
    context: GeneratorContext,
    operation: SemanticOperation,
    adapter: PlatformAdapter,
  ): Promise<DatabaseInsertFunctionResult | null>;
}

/**
 * Genera la Netlify Function funcional para operaciones DATABASE_INSERT.
 */
export class DatabaseInsertFunctionGenerator implements DatabaseInsertFunctionGeneratorService {
  private readonly templateEngine: RuntimeTemplateEngine;
  private readonly fileWriter: GeneratorFileWriter;
  private readonly now: () => Date;

  constructor(options: DatabaseInsertFunctionGeneratorOptions = {}) {
    this.templateEngine = options.templateEngine ?? new RuntimeTemplateEngine();
    this.fileWriter = options.fileWriter ?? new GeneratorFileWriter();
    this.now = options.now ?? (() => new Date());
  }

  async generate(
    context: GeneratorContext,
    operation: SemanticOperation,
    adapter: PlatformAdapter,
  ): Promise<DatabaseInsertFunctionResult | null> {
    if (operation.type !== 'DATABASE_INSERT' || adapter.id !== 'netlify') {
      return null;
    }

    const generatedAt = this.now();
    const fileName = `${operationTypeToFileName(operation.type)}.ts`;
    const relativePath = join(NETLIFY_FUNCTIONS_DIR, fileName);
    const content = await this.templateEngine.render(TEMPLATE_PATH);
    const written = await this.fileWriter.writeFile(context.workspacePath, {
      fileName,
      relativePath,
      content,
    });

    const callee = typeof operation.metadata.callee === 'string' ? operation.metadata.callee : 'addDoc';

    return {
      file: written,
      metadata: {
        reason: TransformationReason.forOperation(operation.type, callee),
        benefit: TransformationBenefit.forOperation(operation.type, callee),
        riskLevel: 'LOW',
        generatedBy: GENERATED_BY,
        generatedAt,
        templateUsed: `templates/${TEMPLATE_PATH}`,
        compilerVersion: VERSION,
        relatedGeneratedFiles: [
          relativePath,
          'runtime/handler.ts',
          'runtime/controllers/databaseController.ts',
          'sdk/index.ts',
        ],
      },
    };
  }
}
