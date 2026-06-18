import { TsMorphProjectLoader } from '../../parser/TsMorphProjectLoader.js';
import type { SourceFile } from 'ts-morph';
import type { ValidationContext } from '../ValidationContext.js';
import { ValidationError } from '../ValidationError.js';
import type { ValidationRule, ValidationRuleResult } from '../ValidationRule.js';

export class TypeScriptCompilationRule implements ValidationRule {
  readonly id = 'typescript-compilation';
  readonly name = 'TypeScript';

  private readonly loader: TsMorphProjectLoader;

  constructor(loader: TsMorphProjectLoader = new TsMorphProjectLoader()) {
    this.loader = loader;
  }

  async validate(context: ValidationContext): Promise<ValidationRuleResult> {
    const project = await this.loader.load(context.workspacePath);
    const sourceFiles = this.loader.getIncludedSourceFiles(project);
    const filesEvaluated = sourceFiles.map((sourceFile) => sourceFile.getFilePath());
    const errors: ValidationError[] = [];

    const diagnostics = project.getPreEmitDiagnostics();

    for (const diagnostic of diagnostics) {
      if (diagnostic.getCategory() !== 1) {
        continue;
      }

      const message = diagnostic.getMessageText();
      const diagnosticMessage =
        typeof message === 'string' ? message : message.getMessageText();

      if (this.isIgnorableDiagnostic(diagnosticMessage, diagnostic.getSourceFile())) {
        continue;
      }

      const sourceFile = diagnostic.getSourceFile();
      const filePath = sourceFile?.getFilePath() ?? context.workspacePath;
      const transformationId = this.findRelatedTransformationId(context, filePath);

      errors.push(
        new ValidationError({
          ruleId: this.id,
          ruleName: this.name,
          message: `${filePath}: ${diagnosticMessage}`,
          files: [filePath],
          transformationId,
        }),
      );
    }

    return {
      passed: errors.length === 0,
      filesEvaluated,
      errors,
    };
  }

  private findRelatedTransformationId(
    context: ValidationContext,
    filePath: string,
  ): string | undefined {
    if (!context.history) {
      return undefined;
    }

    const records = context.history.getRecords();
    const match = records.find(
      (record) =>
        record.file === filePath ||
        record.generatedFiles.some((generated) => filePath.includes(generated)),
    );

    if (match) {
      return match.id;
    }

    return records.filter((record) => record.before.length > 0).at(-1)?.id;
  }

  private isIgnorableDiagnostic(message: string, sourceFile: SourceFile | undefined): boolean {
    if (
      message.includes('deprecated') ||
      message.includes('ignoreDeprecations') ||
      message.includes('baseUrl')
    ) {
      return true;
    }

    return !sourceFile;
  }
}
