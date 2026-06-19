import type { CallExpression, Identifier, Node, SourceFile } from 'ts-morph';
import { Node as MorphNode, SyntaxKind } from 'ts-morph';

import type { DocumentPathParts } from './document-path.js';

export type { DocumentPathParts } from './document-path.js';
export { formatDocumentPathCall, rootCollectionFromParts } from './document-path.js';

/** @deprecated Use DocumentPathParts */
export interface DocReferenceParts {
  collection: string;
  docId: string;
}

export interface QueryFilterParts {
  field: string;
  operator: string;
  value: string;
}

export interface QueryReadParts {
  rootCollection: string;
  collectionArg: string;
  filters: QueryFilterParts[];
}

export function resolveCallExpression(node: Node): CallExpression | undefined {
  if (node.getKind() === SyntaxKind.CallExpression) {
    return node.asKindOrThrow(SyntaxKind.CallExpression);
  }

  if (node.getKind() === SyntaxKind.Identifier) {
    return (
      resolveIdentifierCall(node.asKindOrThrow(SyntaxKind.Identifier)) ??
      resolveFunctionReturnCall(node.asKindOrThrow(SyntaxKind.Identifier))
    );
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

    if (initializer?.getKind() === SyntaxKind.AwaitExpression) {
      const awaited = initializer.asKindOrThrow(SyntaxKind.AwaitExpression).getExpression();

      if (awaited?.getKind() === SyntaxKind.CallExpression) {
        return awaited.asKindOrThrow(SyntaxKind.CallExpression);
      }
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

    if (initializer?.getKind() === SyntaxKind.AwaitExpression) {
      const awaited = initializer.asKindOrThrow(SyntaxKind.AwaitExpression).getExpression();

      if (awaited?.getKind() === SyntaxKind.CallExpression) {
        return awaited.asKindOrThrow(SyntaxKind.CallExpression);
      }
    }
  }

  return undefined;
}

function resolveFunctionReturnCall(identifier: Identifier): CallExpression | undefined {
  const symbol = identifier.getSymbol() ?? identifier.getType().getSymbol();

  if (!symbol) {
    return undefined;
  }

  for (const declaration of symbol.getDeclarations()) {
    if (declaration.getKind() !== SyntaxKind.FunctionDeclaration) {
      continue;
    }

    const functionDeclaration = declaration.asKindOrThrow(SyntaxKind.FunctionDeclaration);
    const returnStatements = functionDeclaration.getDescendantsOfKind(SyntaxKind.ReturnStatement);

    for (const returnStatement of returnStatements) {
      const expression = returnStatement.getExpression();

      if (!expression) {
        continue;
      }

      const resolved = resolveCallExpression(expression);

      if (resolved) {
        return resolved;
      }
    }
  }

  return undefined;
}

export function extractDocumentPath(docCall: CallExpression): DocumentPathParts | undefined {
  const callee = docCall.getExpression();

  if (callee.getKind() !== SyntaxKind.Identifier || callee.getText() !== 'doc') {
    return undefined;
  }

  const args = docCall.getArguments();

  if (args.length < 3) {
    return undefined;
  }

  const rootArgument = args[1];

  if (!rootArgument) {
    return undefined;
  }

  const rootCollection =
    rootArgument.getKind() === SyntaxKind.StringLiteral
      ? rootArgument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue()
      : rootArgument.getText().replace(/^['"]|['"]$/g, '');
  const segmentArgs: string[] = [];

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index]!;

    if (argument.getKind() === SyntaxKind.StringLiteral) {
      segmentArgs.push(`'${argument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue()}'`);
      continue;
    }

    segmentArgs.push(argument.getText());
  }

  return { rootCollection, segmentArgs };
}

function resolveHelperDocCall(helperCall: CallExpression): CallExpression | undefined {
  const callee = helperCall.getExpression();

  if (callee.getKind() !== SyntaxKind.Identifier) {
    return undefined;
  }

  return resolveFunctionReturnCall(callee.asKindOrThrow(SyntaxKind.Identifier));
}

export function extractDocReference(callExpression: CallExpression): DocumentPathParts | undefined {
  const docArgument = callExpression.getArguments()[0];

  if (!docArgument) {
    return undefined;
  }

  const docCall = resolveCallExpression(docArgument);

  if (docCall) {
    const documentPath = extractDocumentPath(docCall);

    if (documentPath) {
      return documentPath;
    }
  }

  if (docArgument.getKind() === SyntaxKind.CallExpression) {
    const helperCall = docArgument.asKindOrThrow(SyntaxKind.CallExpression);
    const innerDocCall = resolveHelperDocCall(helperCall);

    if (innerDocCall) {
      return extractDocumentPath(innerDocCall);
    }
  }

  return undefined;
}

/** @deprecated Use extractDocumentPath */
export function extractDocParts(docCall: CallExpression): DocReferenceParts | undefined {
  const documentPath = extractDocumentPath(docCall);

  if (!documentPath || documentPath.segmentArgs.length < 2) {
    return undefined;
  }

  return {
    collection: documentPath.rootCollection,
    docId: documentPath.segmentArgs[1] ?? 'undefined',
  };
}

export function extractCollectionArgument(callExpression: CallExpression): string | undefined {
  const collectionArgument = callExpression.getArguments()[0];
  const collectionCall = collectionArgument ? resolveCallExpression(collectionArgument) : undefined;

  if (!collectionCall) {
    return undefined;
  }

  return extractCollectionFromCall(collectionCall);
}

function extractCollectionFromCall(collectionCall: CallExpression): string | undefined {
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

export function extractQueryReadParts(callExpression: CallExpression): QueryReadParts | undefined {
  const queryArgument = callExpression.getArguments()[0];
  const queryCall = queryArgument ? resolveCallExpression(queryArgument) : undefined;

  if (!queryCall) {
    return undefined;
  }

  const queryCallee = queryCall.getExpression();

  if (queryCallee.getKind() !== SyntaxKind.Identifier || queryCallee.getText() !== 'query') {
    return undefined;
  }

  const collectionCall = queryCall.getArguments()[0]
    ? resolveCallExpression(queryCall.getArguments()[0]!)
    : undefined;

  if (!collectionCall) {
    return undefined;
  }

  const collectionArg = extractCollectionFromCall(collectionCall);

  if (!collectionArg) {
    return undefined;
  }

  const rootCollection = collectionCall
    .getArguments()[1]
    ?.asKind(SyntaxKind.StringLiteral)
    ?.getLiteralValue();

  if (!rootCollection) {
    return undefined;
  }

  const filters: QueryFilterParts[] = [];

  for (const argument of queryCall.getArguments().slice(1)) {
    const whereCall = resolveCallExpression(argument);

    if (!whereCall) {
      continue;
    }

    const whereCallee = whereCall.getExpression();

    if (whereCallee.getKind() !== SyntaxKind.Identifier || whereCallee.getText() !== 'where') {
      continue;
    }

    const whereArgs = whereCall.getArguments();

    if (whereArgs.length < 3) {
      continue;
    }

    const fieldArgument = whereArgs[0]!;
    const field =
      fieldArgument.getKind() === SyntaxKind.StringLiteral
        ? fieldArgument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue()
        : fieldArgument.getText();

    filters.push({
      field,
      operator: whereArgs[1]!.getText().replace(/^['"]|['"]$/g, ''),
      value: whereArgs[2]!.getText(),
    });
  }

  return {
    rootCollection,
    collectionArg,
    filters,
  };
}

export function formatListWhereCall(parts: QueryReadParts): string {
  if (parts.filters.length === 0) {
    return `Funimas.database.list(${parts.collectionArg})`;
  }

  const firstFilter = parts.filters[0]!;
  const field =
    firstFilter.field.startsWith("'") || firstFilter.field.startsWith('"')
      ? firstFilter.field
      : `'${firstFilter.field}'`;

  return `Funimas.database.listWhere(${parts.collectionArg}, ${field}, '${firstFilter.operator}', ${firstFilter.value})`;
}

export function extractDeleteDocumentPath(
  callExpression: CallExpression,
): DocumentPathParts | undefined {
  const directReference = extractDocReference(callExpression);

  if (directReference) {
    return directReference;
  }

  const deleteArgument = callExpression.getArguments()[0];

  if (!deleteArgument || deleteArgument.getKind() !== SyntaxKind.PropertyAccessExpression) {
    return undefined;
  }

  const propertyAccess = deleteArgument.asKindOrThrow(SyntaxKind.PropertyAccessExpression);

  if (propertyAccess.getName() !== 'ref') {
    return undefined;
  }

  return resolveSnapshotVariablePath(callExpression.getSourceFile(), propertyAccess.getExpression().getText());
}

function resolveSnapshotVariablePath(
  sourceFile: SourceFile,
  variableName: string,
): DocumentPathParts | undefined {
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (declaration.getName() !== variableName) {
      continue;
    }

    const initializer = declaration.getInitializer();

    if (!initializer) {
      continue;
    }

    const expression =
      initializer.getKind() === SyntaxKind.AwaitExpression
        ? initializer.asKindOrThrow(SyntaxKind.AwaitExpression).getExpression()
        : initializer;

    if (!expression || expression.getKind() !== SyntaxKind.CallExpression) {
      continue;
    }

    const call = expression.asKindOrThrow(SyntaxKind.CallExpression);
    const calleeText = call.getExpression().getText();

    if (calleeText === 'getDoc') {
      return extractDocReference(call);
    }

    if (calleeText === 'Funimas.database.get' || calleeText === 'Funimas.database.getAtPath') {
      return extractPathFromFunimasCall(call);
    }
  }

  return resolveSnapshotFromFunctionParameter(sourceFile, variableName);
}

function extractPathFromFunimasCall(call: CallExpression): DocumentPathParts | undefined {
  const calleeText = call.getExpression().getText();
  const args = call.getArguments();

  if (calleeText === 'Funimas.database.get' && args.length >= 2) {
    const rootCollection = args[0]!.getText().replace(/^['"]|['"]$/g, '');

    return {
      rootCollection,
      segmentArgs: args.map((argument) => argument.getText()),
    };
  }

  if (calleeText === 'Funimas.database.getAtPath' && args.length >= 2) {
    const rootCollection = args[0]!.getText().replace(/^['"]|['"]$/g, '');

    return {
      rootCollection,
      segmentArgs: args.map((argument) => argument.getText()),
    };
  }

  return undefined;
}

function resolveSnapshotFromFunctionParameter(
  sourceFile: SourceFile,
  variableName: string,
): DocumentPathParts | undefined {
  if (variableName !== 'snap') {
    return undefined;
  }

  for (const functionDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
    const path = resolvePathFromFunctionScope(functionDeclaration, variableName);

    if (path) {
      return path;
    }
  }

  for (const functionExpression of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression)) {
    const path = resolvePathFromFunctionScope(functionExpression, variableName);

    if (path) {
      return path;
    }
  }

  return undefined;
}

function resolvePathFromFunctionScope(
  scopeNode: Node,
  variableName: string,
): DocumentPathParts | undefined {
  for (const parameter of scopeNode.getChildrenOfKind(SyntaxKind.SyntaxList).flatMap((child) =>
    child.getChildren(),
  )) {
    if (parameter.getKind() !== SyntaxKind.Parameter) {
      continue;
    }

    const parameterName = parameter.asKindOrThrow(SyntaxKind.Parameter).getName();

    for (const declaration of scopeNode.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      if (declaration.getName() !== variableName) {
        continue;
      }

      const initializer = declaration.getInitializer();

      if (!initializer) {
        continue;
      }

      const expression =
        initializer.getKind() === SyntaxKind.AwaitExpression
          ? initializer.asKindOrThrow(SyntaxKind.AwaitExpression).getExpression()
          : initializer;

      if (!expression || expression.getKind() !== SyntaxKind.CallExpression) {
        continue;
      }

      const call = expression.asKindOrThrow(SyntaxKind.CallExpression);
      const funimasPath = extractPathFromFunimasCall(call);

      if (funimasPath && funimasPath.segmentArgs.length >= 2) {
        return {
          rootCollection: funimasPath.rootCollection,
          segmentArgs: [funimasPath.segmentArgs[0]!, parameterName],
        };
      }
    }
  }

  return undefined;
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
    const documentPath = extractDocumentPath(referenceCall);

    if (!documentPath || documentPath.segmentArgs.length < 2) {
      return undefined;
    }

    return {
      kind: 'document',
      collection: documentPath.rootCollection,
      docId: documentPath.segmentArgs[1] ?? 'undefined',
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

  return extractCollectionFromCall(collectionCall);
}
