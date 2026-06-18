import { TransformationBenefit } from '../../report/TransformationBenefit.js';
import { TransformationReason } from '../../report/TransformationReason.js';
import type { SemanticOperation } from '../../semantic/SemanticOperation.js';
import type { RewriteApplication } from '../RewriteApplication.js';
import type { RewriteContext } from '../RewriteContext.js';
import type { RewriteRule } from '../RewriteRule.js';
import { extractCollectionName, findCallExpressionAt } from '../rewrite-utils.js';

const TEMPLATE_USED = 'templates/netlify/databaseInsert.hbs';

export class DatabaseInsertRewriteRule implements RewriteRule {
  readonly id = 'database-insert-rewrite';
  readonly name = 'DatabaseInsertRewriteRule';

  canApply(operation: SemanticOperation): boolean {
    return (
      operation.type === 'DATABASE_INSERT' &&
      operation.metadata.callee === 'addDoc'
    );
  }

  async apply(context: RewriteContext, operation: SemanticOperation): Promise<RewriteApplication | null> {
    const project = context.getMorphProject();
    const sourceFile = project.getSourceFile(operation.file);

    if (!sourceFile) {
      return null;
    }

    const callExpression = findCallExpressionAt(sourceFile, operation.line, operation.column);

    if (!callExpression || callExpression.getExpression().getText() !== 'addDoc') {
      return null;
    }

    const dataArgument = callExpression.getArguments()[1];

    if (!dataArgument) {
      return null;
    }

    const collectionName = extractCollectionName(callExpression);

    if (!collectionName) {
      return null;
    }

    const before = callExpression.getText();
    const after = `Funimas.database.insert(${collectionName}, ${dataArgument.getText()})`;

    callExpression.replaceWithText(after);

    const callee = typeof operation.metadata.callee === 'string' ? operation.metadata.callee : 'addDoc';

    return {
      before,
      after,
      ruleId: this.id,
      ruleName: this.name,
      reason: TransformationReason.forOperation(operation.type, callee),
      benefit: TransformationBenefit.forOperation(operation.type, callee),
      riskLevel: 'LOW',
      templateUsed: TEMPLATE_USED,
      relatedFiles: ['netlify/functions/database_insert.ts'],
    };
  }
}
