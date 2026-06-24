import { dirname, join, relative } from 'node:path';

import {
  Node,
  type Expression,
  type Project,
  type SourceFile,
  type Statement,
  SyntaxKind,
} from 'ts-morph';

const CONFIGURE_FUNIMAS_IMPORT = 'configureFunimas';

export interface FirebaseAuthConfigurationResult {
  modifiedFiles: string[];
  importsAdded: string[];
}

interface AuthTokenSource {
  tokenExpression: string;
  insertAfter: Statement;
}

/**
 * Wires the generated SDK to Firebase Auth so backend calls include ID tokens.
 */
export class FirebaseAuthConfigurator {
  configure(project: Project, workspacePath: string): FirebaseAuthConfigurationResult {
    const modifiedFiles: string[] = [];
    const importsAdded: string[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      const tokenSources = this.collectAuthTokenSources(sourceFile);

      if (tokenSources.length === 0 || this.hasConfigureFunimasCall(sourceFile)) {
        continue;
      }

      const importAdded = this.ensureConfigureFunimasImport(sourceFile, workspacePath);
      const insertAfter = tokenSources[tokenSources.length - 1]?.insertAfter;

      if (!insertAfter) {
        continue;
      }

      sourceFile.insertText(insertAfter.getEnd(), this.buildConfigureFunimasBlock(tokenSources));

      modifiedFiles.push(sourceFile.getFilePath());

      if (importAdded) {
        importsAdded.push(`@funimas/sdk:${CONFIGURE_FUNIMAS_IMPORT}`);
      }
    }

    return { modifiedFiles, importsAdded };
  }

  private collectAuthTokenSources(sourceFile: SourceFile): AuthTokenSource[] {
    const sources: AuthTokenSource[] = [];
    const seen = new Set<string>();

    const addSource = (tokenExpression: string, insertAfter: Statement): void => {
      if (seen.has(tokenExpression)) {
        return;
      }

      seen.add(tokenExpression);
      sources.push({ tokenExpression, insertAfter });
    };

    for (const statement of sourceFile.getStatements()) {
      this.collectFromVariableStatement(sourceFile, statement, addSource);
    }

    for (const statement of sourceFile.getDescendantsOfKind(SyntaxKind.ExpressionStatement)) {
      this.collectFromExpressionStatement(sourceFile, statement, addSource);
      this.collectRuntimeAuthHolders(statement, addSource);
    }

    return sources;
  }

  private collectFromVariableStatement(
    sourceFile: SourceFile,
    statement: Statement,
    addSource: (tokenExpression: string, insertAfter: Statement) => void,
  ): void {
    if (!Node.isVariableStatement(statement)) {
      return;
    }

    for (const declaration of statement.getDeclarations()) {
      const initializer = declaration.getInitializer();

      if (!initializer || !Node.isCallExpression(initializer)) {
        continue;
      }

      if (!this.isGetAuthCall(sourceFile, initializer.getExpression())) {
        continue;
      }

      if (initializer.getArguments().length === 0) {
        continue;
      }

      const nameNode = declaration.getNameNode();

      if (!Node.isIdentifier(nameNode)) {
        continue;
      }

      addSource(nameNode.getText(), statement);
    }
  }

  private collectFromExpressionStatement(
    sourceFile: SourceFile,
    statement: Statement,
    addSource: (tokenExpression: string, insertAfter: Statement) => void,
  ): void {
    if (!Node.isExpressionStatement(statement)) {
      return;
    }

    const expression = statement.getExpression();

    if (!Node.isBinaryExpression(expression) || expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
      return;
    }

    const left = expression.getLeft();

    if (!Node.isIdentifier(left) || !this.isModuleScopedIdentifier(sourceFile, left.getText())) {
      return;
    }

    const right = expression.getRight();

    if (!Node.isCallExpression(right) || !this.isGetAuthCall(sourceFile, right.getExpression())) {
      return;
    }

    addSource(left.getText(), statement);
  }

  private collectRuntimeAuthHolders(
    statement: Statement,
    addSource: (tokenExpression: string, insertAfter: Statement) => void,
  ): void {
    if (!Node.isExpressionStatement(statement)) {
      return;
    }

    const expression = statement.getExpression();

    if (!Node.isBinaryExpression(expression) || expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
      return;
    }

    const left = expression.getLeft();

    if (!Node.isIdentifier(left)) {
      return;
    }

    const right = expression.getRight();

    if (!Node.isObjectLiteralExpression(right) || !this.objectLiteralHasAuthProperty(right)) {
      return;
    }

    addSource(`${left.getText()}?.auth`, statement);
  }

  private objectLiteralHasAuthProperty(objectLiteral: import('ts-morph').ObjectLiteralExpression): boolean {
    return objectLiteral.getProperties().some((property) => {
      if (Node.isShorthandPropertyAssignment(property)) {
        return property.getName() === 'auth';
      }

      if (Node.isPropertyAssignment(property)) {
        return property.getName() === 'auth';
      }

      return false;
    });
  }

  private isModuleScopedIdentifier(sourceFile: SourceFile, identifierName: string): boolean {
    const declaration = sourceFile.getVariableDeclaration(identifierName);

    if (!declaration) {
      return false;
    }

    const variableStatement = declaration.getVariableStatement();

    if (!variableStatement) {
      return false;
    }

    return variableStatement.getParent() === sourceFile;
  }

  private isGetAuthCall(sourceFile: SourceFile, expression: Expression): boolean {
    if (Node.isIdentifier(expression)) {
      return this.getGetAuthLocalNames(sourceFile).includes(expression.getText());
    }

    if (Node.isPropertyAccessExpression(expression)) {
      return expression.getName() === 'getAuth';
    }

    return false;
  }

  private buildConfigureFunimasBlock(tokenSources: AuthTokenSource[]): string {
    if (tokenSources.length === 1) {
      const tokenExpression = tokenSources[0]?.tokenExpression ?? 'auth';

      return `\n\nconfigureFunimas({
  getIdToken: async () => ${tokenExpression}?.currentUser?.getIdToken() ?? null,
});`;
    }

    const tokenLines = tokenSources.map((source, index) => {
      const variableName = `token${index}`;
      return `    const ${variableName} = await ${source.tokenExpression}?.currentUser?.getIdToken().catch(() => null);
    if (${variableName}) return ${variableName};`;
    });

    return `\n\nconfigureFunimas({
  getIdToken: async () => {
${tokenLines.join('\n')}
    return null;
  },
});`;
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
