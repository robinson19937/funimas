import { TransformationBenefit } from '../../report/TransformationBenefit.js';
import { TransformationReason } from '../../report/TransformationReason.js';
import type { SemanticOperation } from '../../semantic/SemanticOperation.js';
import type { RewriteApplication } from '../RewriteApplication.js';
import type { RewriteContext } from '../RewriteContext.js';
import type { RewriteRule } from '../RewriteRule.js';
import {
  extractSnapshotCallback,
  extractSnapshotTarget,
} from '../firestore-rewrite-utils.js';
import { findCallExpressionAt } from '../rewrite-utils.js';

export class DatabaseSubscribeRewriteRule implements RewriteRule {
  readonly id = 'database-subscribe-rewrite';
  readonly name = 'DatabaseSubscribeRewriteRule';

  canApply(operation: SemanticOperation): boolean {
    return (
      operation.type === 'DATABASE_READ' &&
      operation.metadata.callee === 'onSnapshot'
    );
  }

  async apply(context: RewriteContext, operation: SemanticOperation): Promise<RewriteApplication | null> {
    const sourceFile = context.getMorphProject().getSourceFile(operation.file);

    if (!sourceFile) {
      return null;
    }

    const callExpression = findCallExpressionAt(sourceFile, operation.line, operation.column);

    if (!callExpression || callExpression.getExpression().getText() !== 'onSnapshot') {
      return null;
    }

    const target = extractSnapshotTarget(callExpression);
    const callback = extractSnapshotCallback(callExpression);

    if (!target || !callback) {
      return null;
    }

    const before = callExpression.getText();
    const after =
      target.kind === 'document'
        ? `Funimas.database.poll('${target.collection}', ${target.docId}, ${callback})`
        : `Funimas.database.pollCollection('${target.collection}', ${callback})`;

    callExpression.replaceWithText(after);

    return {
      before,
      after,
      ruleId: this.id,
      ruleName: this.name,
      reason: TransformationReason.forOperation(operation.type, 'onSnapshot'),
      benefit: TransformationBenefit.forOperation(operation.type, 'onSnapshot'),
      riskLevel: 'LOW',
      templateUsed: 'src/generator/templates/sdk/database/DatabaseClient.ts',
      relatedFiles: ['sdk/database/DatabaseClient.ts'],
    };
  }
}
