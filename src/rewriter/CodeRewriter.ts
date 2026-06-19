import { TsMorphProjectLoader } from '../parser/TsMorphProjectLoader.js';

import { Formatter } from './Formatter.js';
import { FirebaseAuthConfigurator } from './FirebaseAuthConfigurator.js';
import { ImportManager } from './ImportManager.js';
import { HtmlScriptExtractor } from '../parser/HtmlScriptExtractor.js';
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
import type { SourceFile } from 'ts-morph';

interface PendingRewrite {
  operation: SemanticOperation;
  application: RewriteApplication;
}

export interface CodeRewriterOptions {
  registry?: RewriteRegistry;
  loader?: TsMorphProjectLoader;
  importManager?: ImportManager;
  formatter?: Formatter;
  firebaseAuthConfigurator?: FirebaseAuthConfigurator;
  htmlScriptExtractor?: HtmlScriptExtractor;
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
  private readonly firebaseAuthConfigurator: FirebaseAuthConfigurator;
  private readonly htmlScriptExtractor: HtmlScriptExtractor;
  private readonly now: () => Date;

  constructor(options: CodeRewriterOptions = {}) {
    this.registry = options.registry ?? createDefaultRewriteRegistry();
    this.loader = options.loader ?? new TsMorphProjectLoader();
    this.importManager = options.importManager ?? new ImportManager();
    this.formatter = options.formatter ?? new Formatter();
    this.firebaseAuthConfigurator = options.firebaseAuthConfigurator ?? new FirebaseAuthConfigurator();
    this.htmlScriptExtractor = options.htmlScriptExtractor ?? new HtmlScriptExtractor();
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

      if (this.importManager.ensureFunimasImport(sourceFile, context.workspacePath)) {
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
          const formattedAfter = this.extractFormattedAfter(
            sourceFile,
            pendingRewrite.operation.line,
            pendingRewrite.application.after,
          );

          await context.history.record({
            file: filePath,
            operation: pendingRewrite.operation.type,
            rewriteRule: pendingRewrite.application.ruleName,
            before: pendingRewrite.application.before,
            after: formattedAfter,
            generatedFiles: pendingRewrite.application.relatedFiles,
            modifiedImports,
            status: 'COMPLETED',
            reason: pendingRewrite.application.reason,
            benefit: pendingRewrite.application.benefit,
            riskLevel: pendingRewrite.application.riskLevel,
            generatedBy: pendingRewrite.application.ruleName,
            templateUsed: pendingRewrite.application.templateUsed,
            sourceLine: pendingRewrite.operation.line,
          });
        }
      }
    }

    const authConfiguration = this.firebaseAuthConfigurator.configure(
      morphProject,
      context.workspacePath,
    );

    for (const filePath of authConfiguration.modifiedFiles) {
      const sourceFile = morphProject.getSourceFile(filePath);

      if (!sourceFile) {
        continue;
      }

      this.formatter.formatAndSave(sourceFile);
      const displayFileName = this.importManager.getDisplayFileName(filePath);

      if (!modifiedFiles.includes(displayFileName)) {
        modifiedFiles.push(displayFileName);
      }
    }

    importsAdded.push(...authConfiguration.importsAdded);

    await this.htmlScriptExtractor.merge(context.workspacePath);

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

  private extractFormattedAfter(sourceFile: SourceFile, line: number, fallback: string): string {
    const lineText = sourceFile.getFullText().split(/\r?\n/)[line - 1]?.trim() ?? '';

    if (lineText.includes('Funimas.')) {
      return lineText;
    }

    return fallback.trim();
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
