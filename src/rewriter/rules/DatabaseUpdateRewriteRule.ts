import { TransformationBenefit } from '../../report/TransformationBenefit.js';
import { TransformationReason } from '../../report/TransformationReason.js';
import type { SemanticOperation } from '../../semantic/SemanticOperation.js';
import type { RewriteApplication } from '../RewriteApplication.js';
import type { RewriteContext } from '../RewriteContext.js';
import type { RewriteRule } from '../RewriteRule.js';
import { extractDocReference } from '../firestore-rewrite-utils.js';
import { findCallExpressionAt } from '../rewrite-utils.js';

export class DatabaseUpdateRewriteRule implements RewriteRule {
  readonly id = 'database-update-rewrite';
  readonly name = 'DatabaseUpdateRewriteRule';

  canApply(operation: SemanticOperation): boolean {
    return (
      operation.type === 'DATABASE_UPDATE' &&
      operation.metadata.callee === 'updateDoc'
    );
  }

  async apply(context: RewriteContext, operation: SemanticOperation): Promise<RewriteApplication | null> {
    const sourceFile = context.getMorphProject().getSourceFile(operation.file);

    if (!sourceFile) {
      return null;
    }

    const callExpression = findCallExpressionAt(sourceFile, operation.line, operation.column);

    if (!callExpression || callExpression.getExpression().getText() !== 'updateDoc') {
      return null;
    }

    const dataArgument = callExpression.getArguments()[1];
    const docReference = extractDocReference(callExpression);

    if (!dataArgument || !docReference) {
      return null;
    }

    const before = callExpression.getText();
    const after = `Funimas.database.update('${docReference.collection}', ${docReference.docId}, ${dataArgument.getText()})`;

    callExpression.replaceWithText(after);

    return {
      before,
      after,
      ruleId: this.id,
      ruleName: this.name,
      reason: TransformationReason.forOperation(operation.type, 'updateDoc'),
      benefit: TransformationBenefit.forOperation(operation.type, 'updateDoc'),
      riskLevel: 'LOW',
      templateUsed: 'templates/runtime/router.hbs',
      relatedFiles: ['runtime/router.ts', 'sdk/database/DatabaseClient.ts'],
    };
  }
}
