import type { CallExpression, Identifier, Node } from 'ts-morph';
import { Node as MorphNode, SyntaxKind } from 'ts-morph';

export interface DocReferenceParts {
  collection: string;
  docId: string;
}

export function resolveCallExpression(node: Node): CallExpression | undefined {
  if (node.getKind() === SyntaxKind.CallExpression) {
    return node.asKindOrThrow(SyntaxKind.CallExpression);
  }

  if (node.getKind() === SyntaxKind.Identifier) {
    return resolveIdentifierCall(node.asKindOrThrow(SyntaxKind.Identifier));
  }

  return undefined;
}

function resolveIdentifierCall(identifier: Identifier): CallExpression | undefined {
  const definitions = identifier.getDefinitionNodes();

  for (const definition of definitions) {
    if (!MorphNode.isVariableDeclaration(definition)) {
      continue;
    }

    const initializer = definition.getInitializer();

    if (initializer?.getKind() === SyntaxKind.CallExpression) {
      return initializer.asKindOrThrow(SyntaxKind.CallExpression);
    }
  }

  const symbol = identifier.getSymbol() ?? identifier.getType().getSymbol();

  if (!symbol) {
    return undefined;
  }

  for (const declaration of symbol.getDeclarations()) {
    if (declaration.getKind() !== SyntaxKind.VariableDeclaration) {
      continue;
    }

    const initializer = declaration.asKindOrThrow(SyntaxKind.VariableDeclaration).getInitializer();

    if (initializer?.getKind() === SyntaxKind.CallExpression) {
      return initializer.asKindOrThrow(SyntaxKind.CallExpression);
    }
  }

  return undefined;
}

export function extractDocReference(callExpression: CallExpression): DocReferenceParts | undefined {
  const docArgument = callExpression.getArguments()[0];
  const docCall = docArgument ? resolveCallExpression(docArgument) : undefined;

  if (!docCall) {
    return undefined;
  }

  return extractDocParts(docCall);
}

export function extractDocParts(docCall: CallExpression): DocReferenceParts | undefined {
  const callee = docCall.getExpression();

  if (callee.getKind() !== SyntaxKind.Identifier || callee.getText() !== 'doc') {
    return undefined;
  }

  const collectionArgument = docCall.getArguments()[1];
  const docIdArgument = docCall.getArguments()[2];

  if (!collectionArgument || collectionArgument.getKind() !== SyntaxKind.StringLiteral) {
    return undefined;
  }

  if (!docIdArgument) {
    return undefined;
  }

  return {
    collection: collectionArgument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue(),
    docId: docIdArgument.getText(),
  };
}

export function extractCollectionArgument(callExpression: CallExpression): string | undefined {
  const collectionArgument = callExpression.getArguments()[0];
  const collectionCall = collectionArgument ? resolveCallExpression(collectionArgument) : undefined;

  if (!collectionCall) {
    return undefined;
  }

  const callee = collectionCall.getExpression();

  if (callee.getKind() !== SyntaxKind.Identifier || callee.getText() !== 'collection') {
    return undefined;
  }

  const nameArgument = collectionCall.getArguments()[1];

  if (!nameArgument) {
    return undefined;
  }

  if (nameArgument.getKind() === SyntaxKind.StringLiteral) {
    return `'${nameArgument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue()}'`;
  }

  return nameArgument.getText();
}

export type SnapshotTarget =
  | { kind: 'document'; collection: string; docId: string }
  | { kind: 'collection'; collection: string };

export function extractSnapshotTarget(
  callExpression: CallExpression,
): SnapshotTarget | undefined {
  const referenceArgument = callExpression.getArguments()[0];
  const referenceCall = referenceArgument ? resolveCallExpression(referenceArgument) : undefined;

  if (!referenceCall) {
    return undefined;
  }

  const callee = referenceCall.getExpression();

  if (callee.getKind() !== SyntaxKind.Identifier) {
    return undefined;
  }

  const calleeName = callee.getText();

  if (calleeName === 'doc') {
    const docReference = extractDocParts(referenceCall);

    if (!docReference) {
      return undefined;
    }

    return {
      kind: 'document',
      collection: docReference.collection,
      docId: docReference.docId,
    };
  }

  if (calleeName === 'collection') {
    const nameArgument = referenceCall.getArguments()[1];

    if (!nameArgument || nameArgument.getKind() !== SyntaxKind.StringLiteral) {
      return undefined;
    }

    return {
      kind: 'collection',
      collection: nameArgument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue(),
    };
  }

  return undefined;
}

export function extractSnapshotCallback(callExpression: CallExpression): string | undefined {
  for (const argument of callExpression.getArguments().slice(1)) {
    const kind = argument.getKind();

    if (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression) {
      return argument.getText();
    }
  }

  return undefined;
}

export function extractCollectionNameFromInsert(callExpression: CallExpression): string | undefined {
  const collectionArgument = callExpression.getArguments()[0];
  const collectionCall = collectionArgument ? resolveCallExpression(collectionArgument) : undefined;

  if (!collectionCall) {
    return undefined;
  }

  const callee = collectionCall.getExpression();

  if (callee.getKind() !== SyntaxKind.Identifier || callee.getText() !== 'collection') {
    return undefined;
  }

  const nameArgument = collectionCall.getArguments()[1];

  if (!nameArgument) {
    return undefined;
  }

  if (nameArgument.getKind() === SyntaxKind.StringLiteral) {
    return `'${nameArgument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue()}'`;
  }

  return nameArgument.getText();
}
