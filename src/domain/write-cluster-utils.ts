import {
  SyntaxKind,
  type Block,
  type CallExpression,
  type Node as MorphNode,
  type Statement,
} from 'ts-morph';

import type { DomainPathSegment } from './DomainMutation.js';

export interface WriteCluster {
  lines: number[];
}

export function collectBlockContainers(body: MorphNode | undefined): Block[] {
  if (!body) {
    return [];
  }

  const blocks: Block[] = [];

  if (body.getKind() === SyntaxKind.Block) {
    blocks.push(body.asKindOrThrow(SyntaxKind.Block));
  }

  body.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.Block) {
      blocks.push(node.asKindOrThrow(SyntaxKind.Block));
    }
  });

  return blocks;
}

export function isDocReferenceSetup(statement: Statement): boolean {
  if (statement.getKind() !== SyntaxKind.VariableStatement) {
    return false;
  }

  return statement
    .asKindOrThrow(SyntaxKind.VariableStatement)
    .getDeclarations()
    .every((declaration) => {
      const initializer = declaration.getInitializer();

      if (!initializer || initializer.getKind() !== SyntaxKind.CallExpression) {
        return false;
      }

      const callee = initializer.asKindOrThrow(SyntaxKind.CallExpression).getExpression().getText();

      return callee === 'doc' || callee.endsWith('.doc');
    });
}

export function findWriteClustersInBlock(block: Block, writeLines: Set<number>): WriteCluster[] {
  const clusters: WriteCluster[] = [];
  let currentCluster: number[] = [];

  for (const statement of block.getStatements()) {
    const nestedBlocks = getNestedBlocks(statement);

    if (nestedBlocks.length > 0) {
      if (currentCluster.length >= 2) {
        clusters.push({ lines: currentCluster });
      }

      currentCluster = [];

      for (const nestedBlock of nestedBlocks) {
        clusters.push(...findWriteClustersInBlock(nestedBlock, writeLines));
      }

      continue;
    }

    const statementWriteLines = collectDirectWriteLines(statement, writeLines);

    if (statementWriteLines.length > 0) {
      currentCluster.push(...statementWriteLines);
      continue;
    }

    if (isDocReferenceSetup(statement)) {
      continue;
    }

    if (currentCluster.length >= 2) {
      clusters.push({ lines: currentCluster });
    }

    currentCluster = [];
  }

  if (currentCluster.length >= 2) {
    clusters.push({ lines: currentCluster });
  }

  return clusters;
}

function getNestedBlocks(statement: Statement): Block[] {
  switch (statement.getKind()) {
    case SyntaxKind.IfStatement: {
      const ifStatement = statement.asKindOrThrow(SyntaxKind.IfStatement);
      const blocks: Block[] = [];
      const consequent = ifStatement.getThenStatement();
      const alternate = ifStatement.getElseStatement();

      if (consequent.getKind() === SyntaxKind.Block) {
        blocks.push(consequent.asKindOrThrow(SyntaxKind.Block));
      }

      if (alternate?.getKind() === SyntaxKind.Block) {
        blocks.push(alternate.asKindOrThrow(SyntaxKind.Block));
      }

      return blocks;
    }
    case SyntaxKind.TryStatement: {
      const tryStatement = statement.asKindOrThrow(SyntaxKind.TryStatement);
      const blocks = [tryStatement.getTryBlock()];

      const catchClause = tryStatement.getCatchClause();

      if (catchClause) {
        blocks.push(catchClause.getBlock());
      }

      const finallyBlock = tryStatement.getFinallyBlock();

      if (finallyBlock) {
        blocks.push(finallyBlock);
      }

      return blocks;
    }
    case SyntaxKind.ForStatement:
    case SyntaxKind.ForInStatement:
    case SyntaxKind.ForOfStatement:
    case SyntaxKind.WhileStatement:
    case SyntaxKind.DoStatement: {
      const loopStatement = statement.asKindOrThrow(
        statement.getKind() as
          | SyntaxKind.ForStatement
          | SyntaxKind.ForInStatement
          | SyntaxKind.ForOfStatement
          | SyntaxKind.WhileStatement
          | SyntaxKind.DoStatement,
      );
      const loopBody = (loopStatement as { getStatement: () => Statement }).getStatement();

      if (loopBody.getKind() === SyntaxKind.Block) {
        return [loopBody.asKindOrThrow(SyntaxKind.Block)];
      }

      return [];
    }
    default:
      return [];
  }
}

function collectDirectWriteLines(statement: Statement, writeLines: Set<number>): number[] {
  const lines: number[] = [];

  if (statement.getKind() === SyntaxKind.ExpressionStatement) {
    const expression = statement.asKindOrThrow(SyntaxKind.ExpressionStatement).getExpression();
    const callExpression = unwrapAwaitCall(expression);

    if (callExpression && isFirestoreWriteCall(callExpression) && writeLines.has(callExpression.getStartLineNumber())) {
      lines.push(callExpression.getStartLineNumber());
    }
  }

  if (statement.getKind() === SyntaxKind.VariableStatement) {
    for (const declaration of statement.asKindOrThrow(SyntaxKind.VariableStatement).getDeclarations()) {
      const initializer = declaration.getInitializer();
      const callExpression = initializer ? unwrapAwaitCall(initializer) : undefined;

      if (
        callExpression &&
        isFirestoreWriteCall(callExpression) &&
        writeLines.has(callExpression.getStartLineNumber())
      ) {
        lines.push(callExpression.getStartLineNumber());
      }
    }
  }

  return lines;
}

function unwrapAwaitCall(expression: MorphNode): CallExpression | undefined {
  const target =
    expression.getKind() === SyntaxKind.AwaitExpression
      ? expression.asKindOrThrow(SyntaxKind.AwaitExpression).getExpression()
      : expression;

  if (target.getKind() !== SyntaxKind.CallExpression) {
    return undefined;
  }

  return target.asKindOrThrow(SyntaxKind.CallExpression);
}

function isFirestoreWriteCall(callExpression: CallExpression): boolean {
  const calleeText = callExpression.getExpression().getText();

  return (
    calleeText === 'setDoc' ||
    calleeText === 'addDoc' ||
    calleeText === 'updateDoc' ||
    calleeText === 'deleteDoc' ||
    /^(\w+)\.(set|update|delete)$/.test(calleeText)
  );
}

export function inferAnonymousMutationId(
  writes: Array<{ path: DomainPathSegment[] }>,
  firstLine: number,
): string {
  const collections = new Set<string>();

  for (const write of writes) {
    for (const segment of write.path) {
      if (typeof segment === 'string') {
        collections.add(segment);
      }
    }
  }

  if (collections.has('users') && collections.has('companies') && writes.length >= 3) {
    return 'registerCompany';
  }

  return `domainMutation_${firstLine}`;
}
