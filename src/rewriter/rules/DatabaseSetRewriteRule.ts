import { TransformationBenefit } from '../../report/TransformationBenefit.js';
import { TransformationReason } from '../../report/TransformationReason.js';
import type { SemanticOperation } from '../../semantic/SemanticOperation.js';
import type { RewriteApplication } from '../RewriteApplication.js';
import type { RewriteContext } from '../RewriteContext.js';
import type { RewriteRule } from '../RewriteRule.js';
import { extractDocReference, formatDocumentPathCall } from '../firestore-rewrite-utils.js';
import { findCallExpressionAt } from '../rewrite-utils.js';

export class DatabaseSetRewriteRule implements RewriteRule {
  readonly id = 'database-set-rewrite';
  readonly name = 'DatabaseSetRewriteRule';

  canApply(operation: SemanticOperation): boolean {
    return (
      operation.type === 'DATABASE_INSERT' &&
      operation.metadata.callee === 'setDoc'
    );
  }

  async apply(context: RewriteContext, operation: SemanticOperation): Promise<RewriteApplication | null> {
    const sourceFile = context.getMorphProject().getSourceFile(operation.file);

    if (!sourceFile) {
      return null;
    }

    const callExpression = findCallExpressionAt(sourceFile, operation.line, operation.column);

    if (!callExpression || callExpression.getExpression().getText() !== 'setDoc') {
      return null;
    }

    const dataArgument = callExpression.getArguments()[1];
    const docReference = extractDocReference(callExpression);

    if (!dataArgument || !docReference) {
      return null;
    }

    const before = callExpression.getText();
    const after = formatDocumentPathCall('set', docReference, [dataArgument.getText()]);

    callExpression.replaceWithText(after);

    return {
      before,
      after,
      ruleId: this.id,
      ruleName: this.name,
      reason: TransformationReason.forOperation(operation.type, 'setDoc'),
      benefit: TransformationBenefit.forOperation(operation.type, 'setDoc'),
      riskLevel: 'LOW',
      templateUsed: 'templates/runtime/router.hbs',
      relatedFiles: ['runtime/router.ts', 'sdk/database/DatabaseClient.ts'],
    };
  }
}
