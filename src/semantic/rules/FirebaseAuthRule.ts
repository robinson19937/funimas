import { SemanticOperation } from '../SemanticOperation.js';
import type { SemanticOperationType } from '../SemanticOperationType.js';
import type { SemanticContext } from '../SemanticContext.js';
import type { SemanticRule } from '../SemanticRule.js';

const AUTH_CALLS: Record<string, SemanticOperationType> = {
  signInWithEmailAndPassword: 'AUTH_LOGIN',
  createUserWithEmailAndPassword: 'AUTH_REGISTER',
  signOut: 'AUTH_LOGOUT',
  sendPasswordResetEmail: 'CUSTOM',
};

export class FirebaseAuthRule implements SemanticRule {
  readonly id = 'firebase-auth';
  readonly name = 'Firebase Auth Rule';

  analyze(context: SemanticContext): SemanticOperation[] {
    const operations: SemanticOperation[] = [];

    for (const match of context.findCallExpressions(Object.keys(AUTH_CALLS))) {
      const operationType = AUTH_CALLS[match.calleeName];

      operations.push(
        new SemanticOperation({
          type: operationType,
          file: match.sourceFile.getFilePath(),
          line: match.line,
          column: match.column,
          description: `Operación Firebase Auth detectada: ${match.calleeName}()`,
          metadata: {
            provider: 'firebase',
            category: 'auth',
            callee: match.calleeName,
            ruleId: this.id,
          },
        }),
      );
    }

    return operations;
  }
}
