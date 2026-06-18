import { SemanticOperation } from '../SemanticOperation.js';
import type { SemanticOperationType } from '../SemanticOperationType.js';
import type { SemanticContext } from '../SemanticContext.js';
import type { SemanticRule } from '../SemanticRule.js';

const STORAGE_CALLS: Record<string, SemanticOperationType> = {
  uploadBytes: 'FILE_UPLOAD',
  deleteObject: 'FILE_DELETE',
  getDownloadURL: 'CUSTOM',
};

export class FirebaseStorageRule implements SemanticRule {
  readonly id = 'firebase-storage';
  readonly name = 'Firebase Storage Rule';

  analyze(context: SemanticContext): SemanticOperation[] {
    const operations: SemanticOperation[] = [];

    for (const match of context.findCallExpressions(Object.keys(STORAGE_CALLS))) {
      const operationType = STORAGE_CALLS[match.calleeName];

      operations.push(
        new SemanticOperation({
          type: operationType,
          file: match.sourceFile.getFilePath(),
          line: match.line,
          column: match.column,
          description: `Operación Firebase Storage detectada: ${match.calleeName}()`,
          metadata: {
            provider: 'firebase',
            category: 'storage',
            callee: match.calleeName,
            ruleId: this.id,
          },
        }),
      );
    }

    return operations;
  }
}
