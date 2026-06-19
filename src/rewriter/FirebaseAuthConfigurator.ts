import { dirname, join, relative } from 'node:path';

import { Node, type Project, type SourceFile, type Statement, SyntaxKind } from 'ts-morph';

const CONFIGURE_FUNIMAS_IMPORT = 'configureFunimas';

export interface FirebaseAuthConfigurationResult {
  modifiedFiles: string[];
  importsAdded: string[];
}

/**
 * Wires the generated SDK to Firebase Auth so backend calls include ID tokens.
 */
export class FirebaseAuthConfigurator {
  configure(project: Project, workspacePath: string): FirebaseAuthConfigurationResult {
    const modifiedFiles: string[] = [];
    const importsAdded: string[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      const authBinding = this.findAuthBinding(sourceFile);

      if (!authBinding || this.hasConfigureFunimasCall(sourceFile)) {
        continue;
      }

      const importAdded = this.ensureConfigureFunimasImport(sourceFile, workspacePath);
      const statement = authBinding.statement;
      const statements = sourceFile.getStatements();
      const statementIndex = statements.findIndex((candidate) => candidate === statement);

      if (statementIndex === -1) {
        continue;
      }

      sourceFile.insertStatements(
        statementIndex + 1,
        `\nconfigureFunimas({
  getIdToken: async () => ${authBinding.authVariable}.currentUser?.getIdToken() ?? null,
});`,
      );

      modifiedFiles.push(sourceFile.getFilePath());

      if (importAdded) {
        importsAdded.push(`@funimas/sdk:${CONFIGURE_FUNIMAS_IMPORT}`);
      }
    }

    return { modifiedFiles, importsAdded };
  }

  private findAuthBinding(
    sourceFile: SourceFile,
  ): { authVariable: string; statement: Statement } | undefined {
    const getAuthLocalNames = this.getGetAuthLocalNames(sourceFile);

    if (getAuthLocalNames.length === 0) {
      return undefined;
    }

    for (const statement of sourceFile.getStatements()) {
      if (!Node.isVariableStatement(statement)) {
        continue;
      }

      for (const declaration of statement.getDeclarations()) {
        const initializer = declaration.getInitializer();

        if (!initializer || !Node.isCallExpression(initializer)) {
          continue;
        }

        const expression = initializer.getExpression();

        if (!Node.isIdentifier(expression) || !getAuthLocalNames.includes(expression.getText())) {
          continue;
        }

        if (initializer.getArguments().length === 0) {
          continue;
        }

        const nameNode = declaration.getNameNode();

        if (!Node.isIdentifier(nameNode)) {
          continue;
        }

        return {
          authVariable: nameNode.getText(),
          statement,
        };
      }
    }

    return undefined;
  }

  private getGetAuthLocalNames(sourceFile: SourceFile): string[] {
    const localNames: string[] = [];

    for (const declaration of sourceFile.getImportDeclarations()) {
      if (!this.isFirebaseAuthModule(declaration.getModuleSpecifierValue())) {
        continue;
      }

      for (const namedImport of declaration.getNamedImports()) {
        if (namedImport.getName() !== 'getAuth') {
          continue;
        }

        localNames.push(namedImport.getAliasNode()?.getText() ?? 'getAuth');
      }
    }

    return localNames;
  }

  private isFirebaseAuthModule(moduleSpecifier: string): boolean {
    return moduleSpecifier === 'firebase/auth' || moduleSpecifier.includes('firebase-auth');
  }

  private hasConfigureFunimasCall(sourceFile: SourceFile): boolean {
    return sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((callExpression) => callExpression.getExpression().getText() === CONFIGURE_FUNIMAS_IMPORT);
  }

  private ensureConfigureFunimasImport(sourceFile: SourceFile, workspacePath: string): boolean {
    const moduleSpecifier = this.getSdkModuleSpecifier(sourceFile, workspacePath);
    const existingDeclaration = sourceFile
      .getImportDeclarations()
      .find((declaration) =>
        [moduleSpecifier, '@funimas/sdk'].includes(declaration.getModuleSpecifierValue()),
      );

    if (existingDeclaration) {
      const hasConfigureFunimas = existingDeclaration
        .getNamedImports()
        .some((namedImport) => namedImport.getName() === CONFIGURE_FUNIMAS_IMPORT);

      if (hasConfigureFunimas) {
        return false;
      }

      existingDeclaration.addNamedImport(CONFIGURE_FUNIMAS_IMPORT);
      return true;
    }

    sourceFile.addImportDeclaration({
      namedImports: [CONFIGURE_FUNIMAS_IMPORT],
      moduleSpecifier,
    });

    return true;
  }

  private getSdkModuleSpecifier(sourceFile: SourceFile, workspacePath: string): string {
    const relativePath = relative(dirname(sourceFile.getFilePath()), join(workspacePath, 'sdk/index.js'))
      .replace(/\\/g, '/');

    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
  }
}
