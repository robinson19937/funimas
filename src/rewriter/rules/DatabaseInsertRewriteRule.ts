import type { SemanticOperation } from '../../semantic/SemanticOperation.js';
import type { RewriteContext } from '../RewriteContext.js';
import type { RewriteRule } from '../RewriteRule.js';
import { extractCollectionName, findCallExpressionAt } from '../rewrite-utils.js';

export class DatabaseInsertRewriteRule implements RewriteRule {
  readonly id = 'database-insert-rewrite';
  readonly name = 'Database Insert Rewrite Rule';

  canApply(operation: SemanticOperation): boolean {
    return (
      operation.type === 'DATABASE_INSERT' &&
      operation.metadata.callee === 'addDoc'
    );
  }

  async apply(context: RewriteContext, operation: SemanticOperation): Promise<boolean> {
    const project = context.getMorphProject();
    const sourceFile = project.getSourceFile(operation.file);

    if (!sourceFile) {
      return false;
    }

    const callExpression = findCallExpressionAt(sourceFile, operation.line, operation.column);

    if (!callExpression || callExpression.getExpression().getText() !== 'addDoc') {
      return false;
    }

    const dataArgument = callExpression.getArguments()[1];

    if (!dataArgument) {
      return false;
    }

    const collectionName = extractCollectionName(callExpression);

    if (!collectionName) {
      return false;
    }

    callExpression.replaceWithText(
      `Funimas.database.insert(${collectionName}, ${dataArgument.getText()})`,
    );

    return true;
  }
}
