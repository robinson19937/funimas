import type { CallExpression, SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

import { resolveCallExpression } from './firestore-rewrite-utils.js';

export function findCallExpressionAt(
  sourceFile: SourceFile,
  line: number,
  column: number,
): CallExpression | undefined {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const position = sourceFile.getLineAndColumnAtPos(callExpression.getStart());

    return position.line === line && position.column === column;
  });
}

export function extractCollectionName(callExpression: CallExpression): string | undefined {
  const collectionArgument = callExpression.getArguments()[0];
  const collectionCall = collectionArgument ? resolveCallExpression(collectionArgument) : undefined;

  if (!collectionCall) {
    return undefined;
  }

  const callee = collectionCall.getExpression();

  if (callee.getKind() !== SyntaxKind.Identifier || callee.getText() !== 'collection') {
    return undefined;
  }

  const collectionNameArgument = collectionCall.getArguments()[1];

  if (!collectionNameArgument) {
    return undefined;
  }

  return collectionNameArgument.getText();
}
