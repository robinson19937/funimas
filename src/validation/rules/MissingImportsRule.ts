import { TsMorphProjectLoader } from '../../parser/TsMorphProjectLoader.js';
import type { ValidationContext } from '../ValidationContext.js';
import { ValidationError } from '../ValidationError.js';
import type { ValidationRule, ValidationRuleResult } from '../ValidationRule.js';

export class MissingImportsRule implements ValidationRule {
  readonly id = 'missing-imports';
  readonly name = 'Imports';

  private readonly loader: TsMorphProjectLoader;

  constructor(loader: TsMorphProjectLoader = new TsMorphProjectLoader()) {
    this.loader = loader;
  }

  async validate(context: ValidationContext): Promise<ValidationRuleResult> {
    const project = await this.loader.load(context.workspacePath);
    const sourceFiles = this.loader.getIncludedSourceFiles(project);
    const filesEvaluated = sourceFiles.map((sourceFile) => sourceFile.getFilePath());
    const errors: ValidationError[] = [];

    for (const sourceFile of sourceFiles) {
      for (const importDeclaration of sourceFile.getImportDeclarations()) {
        const moduleSpecifier = importDeclaration.getModuleSpecifierValue();

        if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('@funimas/')) {
          const resolved = importDeclaration.getModuleSpecifierSourceFile();

          if (!resolved) {
            const record = context.history
              ?.getRecords()
              .find((entry) => entry.file === sourceFile.getFilePath());

            errors.push(
              new ValidationError({
                ruleId: this.id,
                ruleName: this.name,
                message: `Import no resuelto: ${moduleSpecifier}`,
                files: [sourceFile.getFilePath()],
                transformationId: record?.id,
              }),
            );
          }
        }
      }
    }

    return {
      passed: errors.length === 0,
      filesEvaluated,
      errors,
    };
  }
}
