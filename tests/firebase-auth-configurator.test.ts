import { join } from 'node:path';

import { Project, SyntaxKind } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { FirebaseAuthConfigurator } from '../src/rewriter/FirebaseAuthConfigurator.js';

describe('FirebaseAuthConfigurator', () => {
  it('configura el SDK cuando Firebase Auth viene de imports CDN del navegador', () => {
    const workspacePath = '/tmp/funimas-auth-cdn';
    const project = new Project({
      compilerOptions: {
        allowJs: true,
      },
    });
    const sourceFile = project.createSourceFile(
      join(workspacePath, 'js/firebase.js'),
      `import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp({});
const auth = getAuth(app);
`,
    );

    const result = new FirebaseAuthConfigurator().configure(project, workspacePath);
    sourceFile.organizeImports();
    sourceFile.formatText({ indentSize: 2 });
    const content = sourceFile.getFullText();
    const authIndex = content.indexOf('const auth = getAuth(app);');
    const configureIndex = content.indexOf('configureFunimas({');

    expect(result.modifiedFiles).toEqual([join(workspacePath, 'js/firebase.js')]);
    expect(content).toContain('import { configureFunimas } from "../sdk/index.js";');
    expect(content).toContain('getIdToken: async () => auth.currentUser?.getIdToken() ?? null');
    expect(configureIndex).toBeGreaterThan(authIndex);
  });

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
