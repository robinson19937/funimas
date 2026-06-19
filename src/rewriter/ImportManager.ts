import { basename, dirname, extname, join, relative } from 'node:path';

import type { SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

const FUNIMAS_SDK_MODULE = '@funimas/sdk';
const FUNIMAS_IMPORT_NAME = 'Funimas';

/**
 * Gestiona imports del SDK Funimas y elimina símbolos de Firebase no utilizados.
 */
export class ImportManager {
  ensureFunimasImport(sourceFile: SourceFile, workspacePath?: string): boolean {
    const moduleSpecifier = this.getFunimasModuleSpecifier(sourceFile, workspacePath);
    const existingDeclaration = sourceFile
      .getImportDeclarations()
      .find((declaration) =>
        [moduleSpecifier, FUNIMAS_SDK_MODULE].includes(declaration.getModuleSpecifierValue()),
      );

    if (existingDeclaration) {
      if (existingDeclaration.getModuleSpecifierValue() !== moduleSpecifier) {
        existingDeclaration.setModuleSpecifier(moduleSpecifier);
      }

      const hasFunimas = existingDeclaration
        .getNamedImports()
        .some((namedImport) => namedImport.getName() === FUNIMAS_IMPORT_NAME);

      if (hasFunimas) {
        return false;
      }

      existingDeclaration.addNamedImport(FUNIMAS_IMPORT_NAME);
      return true;
    }

    sourceFile.addImportDeclaration({
      namedImports: [FUNIMAS_IMPORT_NAME],
      moduleSpecifier,
    });

    return true;
  }

  removeUnusedImports(sourceFile: SourceFile): string[] {
    const removed: string[] = [];

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      if (!importDeclaration.getModuleSpecifierValue().includes('firebase/')) {
        continue;
      }

      for (const namedImport of [...importDeclaration.getNamedImports()]) {
        const importName = namedImport.getName();

        if (!this.isIdentifierUsedInFile(sourceFile, importName)) {
          namedImport.remove();
          removed.push(importName);
        }
      }

      if (importDeclaration.getNamedImports().length === 0) {
        importDeclaration.remove();
      }
    }

    return removed;
  }

  private isIdentifierUsedInFile(sourceFile: SourceFile, identifierName: string): boolean {
    return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => {
      if (identifier.getText() !== identifierName) {
        return false;
      }

      return identifier.getParent()?.getKind() !== SyntaxKind.ImportSpecifier;
    });
  }

  getDisplayFileName(filePath: string): string {
    return basename(filePath);
  }

  private getFunimasModuleSpecifier(sourceFile: SourceFile, workspacePath?: string): string {
    const extension = extname(sourceFile.getFilePath()).toLowerCase();

    if (!workspacePath || !['.js', '.mjs'].includes(extension)) {
      return FUNIMAS_SDK_MODULE;
    }

    const relativePath = relative(dirname(sourceFile.getFilePath()), join(workspacePath, 'sdk/index.js'))
      .replace(/\\/g, '/');

    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
  }
}
