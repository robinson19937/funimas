import { Node, SyntaxKind, type SourceFile, type FunctionDeclaration, type FunctionExpression, type Statement } from 'ts-morph';

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
    const sortedMutations = [...mutations].sort((left, right) => {
      const scopeRank = (mutation: DomainMutation): number =>
        mutation.replacementScope === 'statement-range' ? 0 : 1;
      const scopeDiff = scopeRank(left) - scopeRank(right);

      if (scopeDiff !== 0) {
        return scopeDiff;
      }

      const leftLine = left.statementStartLine ?? left.startLine;
      const rightLine = right.statementStartLine ?? right.startLine;

      return rightLine - leftLine;
    });

    for (const mutation of sortedMutations) {
      const sourceFile = project.getSourceFile(mutation.file);

      if (!sourceFile) {
        continue;
      }

      const applied =
        mutation.replacementScope === 'statement-range'
          ? this.rewriteStatementRange(sourceFile, mutation)
          : this.rewriteMutationFunction(sourceFile, mutation);

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
      mutationsApplied: sortedMutations.length,
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

  private rewriteStatementRange(sourceFile: SourceFile, mutation: DomainMutation): boolean {
    const startLine = mutation.statementStartLine;
    const endLine = mutation.statementEndLine;

    if (startLine === undefined || endLine === undefined) {
      return false;
    }

    const writeLines = new Set(
      mutation.operationKeys
        .map((key) => Number(key.split(':').at(-1)))
        .filter((line) => Number.isFinite(line)),
    );
    const statementsToReplace: Statement[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isStatement(node)) {
        return;
      }

      if (!this.isStatementInsideAnonymousCallback(node, mutation.startLine)) {
        return;
      }

      if (!this.statementContainsWriteLine(node, writeLines)) {
        return;
      }

      const statementStart = node.getStartLineNumber();

      if (statementStart < startLine || statementStart > endLine) {
        return;
      }

      statementsToReplace.push(node);
    });

    if (statementsToReplace.length === 0) {
      return false;
    }

    const paramsObject = mutation.invokeParams.length
      ? `{ ${mutation.invokeParams.join(', ')} }`
      : '{}';
    const replacement = `await Funimas.domain.execute('${mutation.id}', ${paramsObject});`;

    statementsToReplace[0].replaceWithText(replacement);

    for (let index = 1; index < statementsToReplace.length; index += 1) {
      statementsToReplace[index]?.remove();
    }

    return true;
  }

  private isStatementInsideAnonymousCallback(node: Node, callbackStartLine: number): boolean {
    let current: Node | undefined = node;

    while (current) {
      if (
        current.getKind() === SyntaxKind.ArrowFunction ||
        current.getKind() === SyntaxKind.FunctionExpression
      ) {
        return current.getStartLineNumber() === callbackStartLine;
      }

      current = current.getParent();
    }

    return false;
  }

  private statementContainsWriteLine(statement: Statement, writeLines: Set<number>): boolean {
    let found = false;

    statement.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) {
        return;
      }

      const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);
      const calleeText = callExpression.getExpression().getText();
      const isWrite =
        calleeText === 'setDoc' ||
        calleeText === 'addDoc' ||
        calleeText === 'updateDoc' ||
        calleeText === 'deleteDoc' ||
        /^(\w+)\.(set|update|delete)$/.test(calleeText);

      if (isWrite && writeLines.has(callExpression.getStartLineNumber())) {
        found = true;
      }
    });

    return found;
  }
}
