import { TransformationBenefit } from '../../report/TransformationBenefit.js';
import { TransformationReason } from '../../report/TransformationReason.js';
import type { SemanticOperation } from '../../semantic/SemanticOperation.js';
import type { RewriteApplication } from '../RewriteApplication.js';
import type { RewriteContext } from '../RewriteContext.js';
import type { RewriteRule } from '../RewriteRule.js';
import {
  extractCollectionArgument,
  extractDocReference,
} from '../firestore-rewrite-utils.js';
import { findCallExpressionAt } from '../rewrite-utils.js';

export class DatabaseReadRewriteRule implements RewriteRule {
  readonly id = 'database-read-rewrite';
  readonly name = 'DatabaseReadRewriteRule';

  canApply(operation: SemanticOperation): boolean {
    return (
      operation.type === 'DATABASE_READ' &&
      (operation.metadata.callee === 'getDoc' || operation.metadata.callee === 'getDocs')
    );
  }

  async apply(context: RewriteContext, operation: SemanticOperation): Promise<RewriteApplication | null> {
    const sourceFile = context.getMorphProject().getSourceFile(operation.file);

    if (!sourceFile) {
      return null;
    }

    const callExpression = findCallExpressionAt(sourceFile, operation.line, operation.column);
    const callee = operation.metadata.callee;

    if (!callExpression || typeof callee !== 'string') {
      return null;
    }

    const before = callExpression.getText();
    let after: string | undefined;

    if (callee === 'getDoc') {
      const docReference = extractDocReference(callExpression);

      if (!docReference) {
        return null;
      }

      after = `Funimas.database.get('${docReference.collection}', ${docReference.docId})`;
    }

    if (callee === 'getDocs') {
      const collectionArgument = extractCollectionArgument(callExpression);

      if (!collectionArgument) {
        return null;
      }

      after = `Funimas.database.list(${collectionArgument})`;
    }

    if (!after) {
      return null;
    }

    callExpression.replaceWithText(after);

    return {
      before,
      after,
      ruleId: this.id,
      ruleName: this.name,
      reason: TransformationReason.forOperation(operation.type, callee),
      benefit: TransformationBenefit.forOperation(operation.type, callee),
      riskLevel: 'LOW',
      templateUsed: 'templates/runtime/router.hbs',
      relatedFiles: ['runtime/router.ts', 'sdk/database/DatabaseClient.ts'],
    };
  }
}
