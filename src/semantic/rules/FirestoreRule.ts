import { SemanticOperation } from '../SemanticOperation.js';
import type { SemanticOperationType } from '../SemanticOperationType.js';
import type { SemanticContext } from '../SemanticContext.js';
import type { SemanticRule } from '../SemanticRule.js';

const FIRESTORE_CALLS: Record<string, SemanticOperationType> = {
  addDoc: 'DATABASE_INSERT',
  setDoc: 'DATABASE_INSERT',
  updateDoc: 'DATABASE_UPDATE',
  deleteDoc: 'DATABASE_DELETE',
  getDoc: 'DATABASE_READ',
  getDocs: 'DATABASE_READ',
};

export class FirestoreRule implements SemanticRule {
  readonly id = 'firebase-firestore';
  readonly name = 'Firestore Rule';

  analyze(context: SemanticContext): SemanticOperation[] {
    const operations: SemanticOperation[] = [];

    for (const match of context.findCallExpressions(Object.keys(FIRESTORE_CALLS))) {
      const operationType = FIRESTORE_CALLS[match.calleeName];

      operations.push(
        new SemanticOperation({
          type: operationType,
          file: match.sourceFile.getFilePath(),
          line: match.line,
          column: match.column,
          description: `Operación Firestore detectada: ${match.calleeName}()`,
          metadata: {
            provider: 'firebase',
            category: 'firestore',
            callee: match.calleeName,
            ruleId: this.id,
          },
        }),
      );
    }

    return operations;
  }
}
