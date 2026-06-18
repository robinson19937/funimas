import { SemanticOperation } from '../SemanticOperation.js';
import type { SemanticContext } from '../SemanticContext.js';
import type { SemanticRule } from '../SemanticRule.js';

export const FIREBASE_MODULES = [
  'firebase/app',
  'firebase/firestore',
  'firebase/auth',
  'firebase/storage',
] as const;

export class FirebaseImportRule implements SemanticRule {
  readonly id = 'firebase-import';
  readonly name = 'Firebase Import Rule';

  analyze(context: SemanticContext): SemanticOperation[] {
    const operations: SemanticOperation[] = [];

    for (const node of context.graphResult.graph.getNodes()) {
      for (const importInfo of node.imports) {
        const firebaseModule = FIREBASE_MODULES.find((moduleName) =>
          importInfo.moduleSpecifier.includes(moduleName),
        );

        if (!firebaseModule) {
          continue;
        }

        operations.push(
          new SemanticOperation({
            type: 'CUSTOM',
            file: node.path,
            line: 1,
            column: 1,
            description: `Import de Firebase detectado: ${importInfo.moduleSpecifier}`,
            metadata: {
              provider: 'firebase',
              category: 'import',
              module: firebaseModule,
              moduleSpecifier: importInfo.moduleSpecifier,
              ruleId: this.id,
            },
          }),
        );
      }
    }

    return operations;
  }
}
