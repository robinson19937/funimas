import { basename } from 'node:path';

import type { SourceFile } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

const FUNIMAS_SDK_MODULE = '@funimas/sdk';
const FUNIMAS_IMPORT_NAME = 'Funimas';

/**
 * Gestiona imports del SDK Funimas y elimina símbolos de Firebase no utilizados.
 */
export class ImportManager {
  ensureFunimasImport(sourceFile: SourceFile): boolean {
    const existingDeclaration = sourceFile
      .getImportDeclarations()
      .find((declaration) => declaration.getModuleSpecifierValue() === FUNIMAS_SDK_MODULE);

    if (existingDeclaration) {
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
      moduleSpecifier: FUNIMAS_SDK_MODULE,
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
}
