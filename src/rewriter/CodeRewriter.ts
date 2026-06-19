import { TsMorphProjectLoader } from '../parser/TsMorphProjectLoader.js';

import { Formatter } from './Formatter.js';
import { ImportManager } from './ImportManager.js';
import type { RewriteApplication } from './RewriteApplication.js';
import type { RewriteContext } from './RewriteContext.js';
import { RewriteRegistry } from './RewriteRegistry.js';
import { RewriteResult, createEmptyOperationsRewritten } from './RewriteResult.js';
import { DatabaseInsertRewriteRule } from './rules/DatabaseInsertRewriteRule.js';
import { DatabaseSetRewriteRule } from './rules/DatabaseSetRewriteRule.js';
import { DatabaseUpdateRewriteRule } from './rules/DatabaseUpdateRewriteRule.js';
import { DatabaseDeleteRewriteRule } from './rules/DatabaseDeleteRewriteRule.js';
import { DatabaseReadRewriteRule } from './rules/DatabaseReadRewriteRule.js';
import { DatabaseSubscribeRewriteRule } from './rules/DatabaseSubscribeRewriteRule.js';
import type { SemanticOperation } from '../semantic/SemanticOperation.js';

interface PendingRewrite {
  operation: SemanticOperation;
  application: RewriteApplication;
}

export interface CodeRewriterOptions {
  registry?: RewriteRegistry;
  loader?: TsMorphProjectLoader;
  importManager?: ImportManager;
  formatter?: Formatter;
  now?: () => Date;
}

export interface CodeRewriterService {
  rewrite(context: RewriteContext): Promise<RewriteResult>;
}

/**
 * Motor de reescritura AST basado en reglas extensibles.
 */
export class CodeRewriter implements CodeRewriterService {
  private readonly registry: RewriteRegistry;
  private readonly loader: TsMorphProjectLoader;
  private readonly importManager: ImportManager;
  private readonly formatter: Formatter;
  private readonly now: () => Date;

  constructor(options: CodeRewriterOptions = {}) {
    this.registry = options.registry ?? createDefaultRewriteRegistry();
    this.loader = options.loader ?? new TsMorphProjectLoader();
    this.importManager = options.importManager ?? new ImportManager();
    this.formatter = options.formatter ?? new Formatter();
    this.now = options.now ?? (() => new Date());
  }

  async rewrite(context: RewriteContext): Promise<RewriteResult> {
    const startedAt = this.now();
    const morphProject = await this.loader.load(context.workspacePath);

    context.setMorphProject(morphProject);

    const operationsRewritten = createEmptyOperationsRewritten();
    const modifiedFilePaths = new Set<string>();
    const importsAdded: string[] = [];
    const importsRemoved: string[] = [];
    const pendingRewrites: PendingRewrite[] = [];
    const rewriteableOperations = [...context.getRewriteableOperations()].sort((left, right) => {
      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }

      if (left.line !== right.line) {
        return right.line - left.line;
      }

      return right.column - left.column;
    });

    for (const operation of rewriteableOperations) {
      const rule = this.registry.findRule(operation);

      if (!rule) {
        continue;
      }

      const application = await rule.apply(context, operation);

      if (!application) {
        continue;
      }

      operationsRewritten[operation.type] += 1;
      modifiedFilePaths.add(operation.file);
      pendingRewrites.push({ operation, application });
    }

    const modifiedFiles: string[] = [];

    for (const filePath of modifiedFilePaths) {
      const sourceFile = morphProject.getSourceFile(filePath);

      if (!sourceFile) {
        continue;
      }

      const fileImportsAdded: string[] = [];
      const fileImportsRemoved: string[] = [];

      if (this.importManager.ensureFunimasImport(sourceFile)) {
        fileImportsAdded.push('@funimas/sdk:Funimas');
        importsAdded.push('@funimas/sdk:Funimas');
      }

      const removed = this.importManager.removeUnusedImports(sourceFile);

      fileImportsRemoved.push(...removed);
      importsRemoved.push(...removed);

      this.formatter.formatAndSave(sourceFile);
      modifiedFiles.push(this.importManager.getDisplayFileName(filePath));

      if (context.history) {
        const modifiedImports = [
          ...fileImportsAdded,
          ...fileImportsRemoved.map((importName) => `-${importName}`),
        ];

        for (const pendingRewrite of pendingRewrites.filter(
          (pending) => pending.operation.file === filePath,
        )) {
          await context.history.record({
            file: filePath,
            operation: pendingRewrite.operation.type,
            rewriteRule: pendingRewrite.application.ruleName,
            before: pendingRewrite.application.before,
            after: pendingRewrite.application.after,
            generatedFiles: pendingRewrite.application.relatedFiles,
            modifiedImports,
            status: 'COMPLETED',
            reason: pendingRewrite.application.reason,
            benefit: pendingRewrite.application.benefit,
            riskLevel: pendingRewrite.application.riskLevel,
            generatedBy: pendingRewrite.application.ruleName,
            templateUsed: pendingRewrite.application.templateUsed,
          });
        }
      }
    }

    const finishedAt = this.now();

    return new RewriteResult({
      modifiedFiles,
      operationsRewritten,
      importsAdded,
      importsRemoved,
      startedAt,
      finishedAt,
    });
  }
}

export function createDefaultRewriteRegistry(): RewriteRegistry {
  const registry = new RewriteRegistry();

  registry.register(new DatabaseInsertRewriteRule());
  registry.register(new DatabaseSetRewriteRule());
  registry.register(new DatabaseUpdateRewriteRule());
  registry.register(new DatabaseDeleteRewriteRule());
  registry.register(new DatabaseReadRewriteRule());
  registry.register(new DatabaseSubscribeRewriteRule());

  return registry;
}
