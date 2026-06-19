import { join } from 'node:path';

import { Project, SyntaxKind } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { FirebaseAuthConfigurator } from '../src/rewriter/FirebaseAuthConfigurator.js';

describe('FirebaseAuthConfigurator', () => {
  it('no duplica configureFunimas si el archivo ya está configurado', () => {
    const workspacePath = '/tmp/funimas-auth-config';
    const project = new Project({
      compilerOptions: {
        allowJs: true,
      },
    });
    const sourceFile = project.createSourceFile(
      join(workspacePath, 'src/firebase.ts'),
      `import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { configureFunimas } from '../sdk/index.js';

const app = initializeApp({});
export const auth = getAuth(app);

configureFunimas({
  getIdToken: async () => auth.currentUser?.getIdToken() ?? null,
});
`,
    );

    const result = new FirebaseAuthConfigurator().configure(project, workspacePath);
    const configureCalls = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((callExpression) => callExpression.getExpression().getText() === 'configureFunimas');

    expect(result.modifiedFiles).toHaveLength(0);
    expect(configureCalls).toHaveLength(1);
  });
});
