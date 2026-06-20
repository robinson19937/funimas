import { SyntaxKind, type SourceFile, type FunctionDeclaration, type FunctionExpression } from 'ts-morph';

import { TsMorphProjectLoader } from '../parser/TsMorphProjectLoader.js';
import type { TransformationHistory } from '../history/TransformationHistory.js';

import type { DomainMutation } from './DomainMutation.js';
import { ImportManager } from '../rewriter/ImportManager.js';
import { Formatter } from '../rewriter/Formatter.js';

export interface DomainMutationApplyResult {
  modifiedFiles: string[];
  mutationsApplied: number;
}

export class DomainMutationApplicator {
  private readonly loader = new TsMorphProjectLoader();
  private readonly importManager = new ImportManager();
  private readonly formatter = new Formatter();

  async apply(
    workspacePath: string,
    mutations: DomainMutation[],
    history?: TransformationHistory,
  ): Promise<DomainMutationApplyResult> {
    if (mutations.length === 0) {
      return { modifiedFiles: [], mutationsApplied: 0 };
    }

    const project = await this.loader.load(workspacePath);
    const modifiedFiles = new Set<string>();

    for (const mutation of mutations) {
      const sourceFile = project.getSourceFile(mutation.file);

      if (!sourceFile) {
        continue;
      }

      const applied = this.rewriteMutationFunction(sourceFile, mutation);

      if (!applied) {
        continue;
      }

      if (this.importManager.ensureFunimasImport(sourceFile, workspacePath)) {
        this.importManager.removeUnusedImports(sourceFile);
      }

      this.formatter.formatAndSave(sourceFile);
      modifiedFiles.add(this.importManager.getDisplayFileName(mutation.file));

      if (history) {
        const paramsObject = mutation.invokeParams.length
          ? `{ ${mutation.invokeParams.join(', ')} }`
          : '{}';

        await history.record({
          file: mutation.file,
          operation: 'CUSTOM',
          rewriteRule: 'DomainMutationApplicator',
          before: mutation.functionName,
          after: `Funimas.domain.execute('${mutation.id}', ${paramsObject})`,
          generatedFiles: ['runtime/domain/mutations.ts', 'sdk/domain/DomainClient.ts'],
          modifiedImports: ['@funimas/sdk:Funimas'],
          status: 'COMPLETED',
          reason: 'Agrupa múltiples escrituras Firestore en una mutación de dominio atómica.',
          benefit: 'La lógica compuesta se ejecuta en el servidor sin depender de la estructura de colecciones.',
          riskLevel: 'MEDIUM',
          generatedBy: 'DomainMutationApplicator',
          templateUsed: 'runtime/domain/mutations.ts',
          sourceLine: mutation.startLine,
        });
      }
    }

    return {
      modifiedFiles: [...modifiedFiles],
      mutationsApplied: mutations.length,
    };
  }

  private rewriteMutationFunction(sourceFile: SourceFile, mutation: DomainMutation): boolean {
    const declaration = sourceFile.getFunctions().find((fn) => fn.getName() === mutation.functionName);

    if (declaration?.getBody()) {
      this.replaceFunctionBody(declaration, mutation, declaration.isAsync());
      return true;
    }

    for (const statement of sourceFile.getVariableStatements()) {
      for (const variable of statement.getDeclarations()) {
        if (variable.getName() !== mutation.functionName) {
          continue;
        }

        const initializer = variable.getInitializer();

        if (!initializer) {
          continue;
        }

        if (initializer.getKind() === SyntaxKind.ArrowFunction) {
          const arrow = initializer.asKindOrThrow(SyntaxKind.ArrowFunction);
          this.replaceArrowBody(arrow, mutation, arrow.isAsync());
          return true;
        }

        if (initializer.getKind() === SyntaxKind.FunctionExpression) {
          const expression = initializer.asKindOrThrow(SyntaxKind.FunctionExpression);
          this.replaceFunctionBody(expression, mutation, expression.isAsync());
          return true;
        }
      }
    }

    return false;
  }

  private replaceFunctionBody(
    declaration: FunctionDeclaration | FunctionExpression,
    mutation: DomainMutation,
    isAsync: boolean,
  ): void {
    if (!isAsync) {
      declaration.setIsAsync(true);
    }

    const paramsObject = mutation.invokeParams.length ? `{ ${mutation.invokeParams.join(', ')} }` : '{}';
    declaration.setBodyText(`await Funimas.domain.execute('${mutation.id}', ${paramsObject});`);
  }

  private replaceArrowBody(
    arrow: import('ts-morph').ArrowFunction,
    mutation: DomainMutation,
    isAsync: boolean,
  ): void {
    if (!isAsync) {
      arrow.setIsAsync(true);
    }

    const paramsObject = mutation.invokeParams.length ? `{ ${mutation.invokeParams.join(', ')} }` : '{}';
    arrow.setBodyText(`await Funimas.domain.execute('${mutation.id}', ${paramsObject});`);
  }
}
