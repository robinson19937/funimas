import { TsMorphProjectLoader } from '../parser/TsMorphProjectLoader.js';

import { Formatter } from './Formatter.js';
import { ImportManager } from './ImportManager.js';
import type { RewriteContext } from './RewriteContext.js';
import { RewriteRegistry } from './RewriteRegistry.js';
import { RewriteResult, createEmptyOperationsRewritten } from './RewriteResult.js';
import { DatabaseInsertRewriteRule } from './rules/DatabaseInsertRewriteRule.js';

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

    for (const operation of context.getRewriteableOperations()) {
      const rule = this.registry.findRule(operation);

      if (!rule) {
        continue;
      }

      const applied = await rule.apply(context, operation);

      if (!applied) {
        continue;
      }

      operationsRewritten[operation.type] += 1;
      modifiedFilePaths.add(operation.file);
    }

    const modifiedFiles: string[] = [];

    for (const filePath of modifiedFilePaths) {
      const sourceFile = morphProject.getSourceFile(filePath);

      if (!sourceFile) {
        continue;
      }

      if (this.importManager.ensureFunimasImport(sourceFile)) {
        importsAdded.push('@funimas/sdk:Funimas');
      }

      importsRemoved.push(...this.importManager.removeUnusedImports(sourceFile));
      this.formatter.formatAndSave(sourceFile);
      modifiedFiles.push(this.importManager.getDisplayFileName(filePath));
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

  return registry;
}
