import { SyntaxKind, type Node } from 'ts-morph';

const SERVER_TIMESTAMP_SENTINEL = { __funimasFirestoreSentinel: 'serverTimestamp' };
const INCREMENT_SENTINEL_KEY = '__funimasFirestoreSentinel';

export interface IncrementAmountSpec {
  param: string;
  sign: 1 | -1;
}

export function isIncrementAmountSpec(value: unknown): value is IncrementAmountSpec {
  return (
    typeof value === 'object' &&
    value !== null &&
    'param' in value &&
    typeof (value as IncrementAmountSpec).param === 'string' &&
    'sign' in value &&
    ((value as IncrementAmountSpec).sign === 1 || (value as IncrementAmountSpec).sign === -1)
  );
}

export function buildIncrementSentinel(amount: number | IncrementAmountSpec): Record<string, unknown> {
  return {
    [INCREMENT_SENTINEL_KEY]: 'increment',
    amount,
  };
}

export function buildDataTemplate(node: Node | undefined): Record<string, unknown> | undefined {
  if (!node) {
    return undefined;
  }

  if (node.getKind() === SyntaxKind.ObjectLiteralExpression) {
    return buildObjectTemplate(node);
  }

  return undefined;
}

function buildObjectTemplate(node: Node): Record<string, unknown> {
  const objectLiteral = node.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const template: Record<string, unknown> = {};

  for (const property of objectLiteral.getProperties()) {
    if (property.getKind() === SyntaxKind.SpreadAssignment) {
      continue;
    }

    if (property.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
      const shorthand = property.asKindOrThrow(SyntaxKind.ShorthandPropertyAssignment);
      const name = shorthand.getName();

      template[name] = `$${name}`;
      continue;
    }

    if (property.getKind() !== SyntaxKind.PropertyAssignment) {
      continue;
    }

    const assignment = property.asKindOrThrow(SyntaxKind.PropertyAssignment);
    const name = assignment.getNameNode().getText();
    const value = assignment.getInitializer();

    if (!value) {
      continue;
    }

    template[name] = buildTemplateValue(value);
  }

  return template;
}

function buildTemplateValue(node: Node): unknown {
  switch (node.getKind()) {
    case SyntaxKind.StringLiteral:
      return node.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
    case SyntaxKind.NumericLiteral:
      return Number(node.getText());
    case SyntaxKind.TrueKeyword:
      return true;
    case SyntaxKind.FalseKeyword:
      return false;
    case SyntaxKind.NullKeyword:
      return null;
    case SyntaxKind.Identifier:
      return `$${node.getText()}`;
    case SyntaxKind.PropertyAccessExpression:
      return `$${node.getText()}`;
    case SyntaxKind.BinaryExpression: {
      const increment = buildReadDependentIncrement(node);

      if (increment !== undefined) {
        return increment;
      }

      return `$${node.getText()}`;
    }
    case SyntaxKind.ObjectLiteralExpression:
      return buildObjectTemplate(node);
    case SyntaxKind.ArrayLiteralExpression:
      return node
        .asKindOrThrow(SyntaxKind.ArrayLiteralExpression)
        .getElements()
        .map((element) => buildTemplateValue(element));
    case SyntaxKind.CallExpression: {
      const callee = node.asKindOrThrow(SyntaxKind.CallExpression).getExpression().getText();

      if (callee === 'serverTimestamp' || callee.endsWith('.serverTimestamp')) {
        return SERVER_TIMESTAMP_SENTINEL;
      }

      return `$${node.getText()}`;
    }
    default:
      return `$${node.getText()}`;
  }
}

function buildReadDependentIncrement(node: Node): Record<string, unknown> | undefined {
  const binary = node.asKindOrThrow(SyntaxKind.BinaryExpression);
  const operator = binary.getOperatorToken().getKind();

  if (operator !== SyntaxKind.PlusToken && operator !== SyntaxKind.MinusToken) {
    return undefined;
  }

  const left = binary.getLeft();
  const right = binary.getRight();

  if (!isSnapshotFieldRead(left)) {
    return undefined;
  }

  const sign: 1 | -1 = operator === SyntaxKind.PlusToken ? 1 : -1;

  if (right.getKind() === SyntaxKind.Identifier) {
    return buildIncrementSentinel({
      param: right.getText(),
      sign,
    });
  }

  if (right.getKind() === SyntaxKind.NumericLiteral) {
    return buildIncrementSentinel(sign * Number(right.getText()));
  }

  return undefined;
}

function isSnapshotFieldRead(node: Node): boolean {
  if (node.getKind() !== SyntaxKind.PropertyAccessExpression) {
    return false;
  }

  const propertyAccess = node.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
  const expression = propertyAccess.getExpression();

  if (expression.getKind() !== SyntaxKind.CallExpression) {
    return false;
  }

  const callExpression = expression.asKindOrThrow(SyntaxKind.CallExpression);
  const callee = callExpression.getExpression();

  return (
    callee.getKind() === SyntaxKind.PropertyAccessExpression &&
    callee.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() === 'data'
  );
}

export function segmentArgsToPathTemplate(segmentArgs: string[]): string[] {
  return segmentArgs.map((segment) => {
    const trimmed = segment.trim();

    if (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      return trimmed.slice(1, -1);
    }

    return `$${trimmed}`;
  });
}

export function collectParamNames(params: string[], template: unknown): void {
  if (typeof template === 'string' && template.startsWith('$') && !template.includes('.')) {
    const param = template.slice(1);

    if (param.length > 0 && !params.includes(param)) {
      params.push(param);
    }

    return;
  }

  if (isIncrementAmountSpec(template)) {
    if (!params.includes(template.param)) {
      params.push(template.param);
    }

    return;
  }

  if (Array.isArray(template)) {
    for (const entry of template) {
      collectParamNames(params, entry);
    }

    return;
  }

  if (template && typeof template === 'object') {
    const record = template as Record<string, unknown>;

    if (record[INCREMENT_SENTINEL_KEY] === 'increment' && isIncrementAmountSpec(record.amount)) {
      if (!params.includes(record.amount.param)) {
        params.push(record.amount.param);
      }

      return;
    }

    for (const value of Object.values(template)) {
      collectParamNames(params, value);
    }
  }
}
