import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ValidationContext } from '../ValidationContext.js';
import { ValidationError } from '../ValidationError.js';
import type { ValidationRule, ValidationRuleResult } from '../ValidationRule.js';

export class MissingFilesRule implements ValidationRule {
  readonly id = 'missing-files';
  readonly name = 'Missing Files';

  async validate(context: ValidationContext): Promise<ValidationRuleResult> {
    const workspaceRoot = resolve(context.workspacePath);
    const filesEvaluated: string[] = [];
    const errors: ValidationError[] = [];

    if (!context.history) {
      return { passed: true, filesEvaluated, errors };
    }

    for (const record of context.history.getRecords()) {
      if (record.before.length > 0) {
        filesEvaluated.push(record.file);

        try {
          await access(record.file);
        } catch {
          errors.push(
            new ValidationError({
              ruleId: this.id,
              ruleName: this.name,
              message: `Archivo transformado no encontrado: ${record.file}`,
              files: [record.file],
              transformationId: record.id,
            }),
          );
        }
      }

      for (const generatedFile of record.generatedFiles) {
        const absolutePath = resolve(workspaceRoot, generatedFile);
        filesEvaluated.push(absolutePath);

        try {
          await access(absolutePath);
        } catch {
          errors.push(
            new ValidationError({
              ruleId: this.id,
              ruleName: this.name,
              message: `Archivo generado no encontrado: ${generatedFile}`,
              files: [generatedFile],
              transformationId: record.id,
            }),
          );
        }
      }
    }

    return {
      passed: errors.length === 0,
      filesEvaluated: [...new Set(filesEvaluated)],
      errors,
    };
  }
}
