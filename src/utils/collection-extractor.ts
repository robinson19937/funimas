import type { CallExpression } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

import { TsMorphProjectLoader } from '../parser/TsMorphProjectLoader.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';
import { findCallExpressionAt } from '../rewriter/rewrite-utils.js';

const FIRESTORE_CALLEES = new Set([
  'addDoc',
  'setDoc',
  'updateDoc',
  'deleteDoc',
  'getDoc',
  'getDocs',
  'onSnapshot',
  'collection',
  'doc',
]);

/**
 * Extrae nombres de colección Firestore detectados en el código del workspace.
 */
export async function extractFirestoreCollections(
  workspacePath: string,
  semanticResult: SemanticResult,
): Promise<string[]> {
  const collections = new Set<string>();
  const loader = new TsMorphProjectLoader();
  const project = await loader.load(workspacePath);
  const sourceFiles = loader.getIncludedSourceFiles(project);

  const firestoreOperations = semanticResult.getOperationsByMetadata('category', 'firestore');

  for (const operation of firestoreOperations) {
    const sourceFile = sourceFiles.find((file) => file.getFilePath() === operation.file);

    if (!sourceFile) {
      continue;
    }

    const callExpression = findCallExpressionAt(sourceFile, operation.line, operation.column);

    if (!callExpression) {
      continue;
    }

    const collectionName = extractCollectionFromCall(callExpression);

    if (collectionName) {
      collections.add(collectionName);
    }
  }

  for (const sourceFile of sourceFiles) {
    for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = callExpression.getExpression();

      if (callee.getKind() !== SyntaxKind.Identifier) {
        continue;
      }

      const calleeName = callee.getText();

      if (!FIRESTORE_CALLEES.has(calleeName)) {
        continue;
      }

      const collectionName = extractCollectionFromCall(callExpression);

      if (collectionName) {
        collections.add(collectionName);
      }
    }
  }

  return [...collections].sort();
}

function extractCollectionFromCall(callExpression: CallExpression): string | undefined {
  const callee = callExpression.getExpression();

  if (callee.getKind() !== SyntaxKind.Identifier) {
    return undefined;
  }

  const calleeName = callee.getText();

  if (calleeName === 'collection' || calleeName === 'doc') {
    const collectionArgument = callExpression.getArguments()[1];

    if (!collectionArgument || collectionArgument.getKind() !== SyntaxKind.StringLiteral) {
      return undefined;
    }

    return collectionArgument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
  }

  const collectionArgument = callExpression.getArguments()[0];

  if (!collectionArgument || collectionArgument.getKind() !== SyntaxKind.CallExpression) {
    return undefined;
  }

  const innerCall = collectionArgument.asKindOrThrow(SyntaxKind.CallExpression);
  const innerCallee = innerCall.getExpression();

  if (innerCallee.getKind() !== SyntaxKind.Identifier) {
    return undefined;
  }

  if (innerCallee.getText() === 'collection' || innerCallee.getText() === 'doc') {
    const nameArgument = innerCall.getArguments()[1];

    if (!nameArgument || nameArgument.getKind() !== SyntaxKind.StringLiteral) {
      return undefined;
    }

    return nameArgument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
  }

  return undefined;
}
