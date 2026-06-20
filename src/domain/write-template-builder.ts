import { SyntaxKind, type Node } from 'ts-morph';

const SERVER_TIMESTAMP_SENTINEL = { __funimasFirestoreSentinel: 'serverTimestamp' };

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

  if (Array.isArray(template)) {
    for (const entry of template) {
      collectParamNames(params, entry);
    }

    return;
  }

  if (template && typeof template === 'object') {
    for (const value of Object.values(template)) {
      collectParamNames(params, value);
    }
  }
}
