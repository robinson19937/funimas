import type { SourceFile } from 'ts-morph';

/**
 * Organiza imports y persiste el archivo transformado.
 */
export class Formatter {
  formatAndSave(sourceFile: SourceFile): void {
    sourceFile.organizeImports();
    sourceFile.formatText({
      indentSize: 2,
    });
    sourceFile.saveSync();
  }
}
