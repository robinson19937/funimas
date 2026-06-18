import type { GraphResult } from '../graph/GraphResult.js';

import type { CallExpression, Project, SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

export interface CallExpressionMatch {
  calleeName: string;
  sourceFile: SourceFile;
  callExpression: CallExpression;
  line: number;
  column: number;
}

export class SemanticContext {
  readonly graphResult: GraphResult;
  readonly morphProject: Project;

  constructor(graphResult: GraphResult, morphProject: Project) {
    this.graphResult = graphResult;
    this.morphProject = morphProject;
  }

  getSourceFiles(): SourceFile[] {
    return this.morphProject.getSourceFiles();
  }

  findCallExpressions(calleeNames: readonly string[]): CallExpressionMatch[] {
    const matches: CallExpressionMatch[] = [];
    const calleeNameSet = new Set(calleeNames);

    for (const sourceFile of this.getSourceFiles()) {
      for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const calleeName = this.getCalleeName(callExpression);

        if (!calleeName || !calleeNameSet.has(calleeName)) {
          continue;
        }

        const { line, column } = sourceFile.getLineAndColumnAtPos(callExpression.getStart());

        matches.push({
          calleeName,
          sourceFile,
          callExpression,
          line,
          column,
        });
      }
    }

    return matches;
  }

  private getCalleeName(callExpression: CallExpression): string | undefined {
    const expression = callExpression.getExpression();

    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
      return expression.getLastChildByKind(SyntaxKind.Identifier)?.getText();
    }

    if (expression.getKind() === SyntaxKind.Identifier) {
      return expression.getText();
    }

    return undefined;
  }
}
