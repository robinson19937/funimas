import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { ValidationContext } from '../ValidationContext.js';
import { ValidationError } from '../ValidationError.js';
import type { ValidationRule, ValidationRuleResult } from '../ValidationRule.js';

export class GeneratedFilesRule implements ValidationRule {
  readonly id = 'generated-files';
  readonly name = 'Functions';

  async validate(context: ValidationContext): Promise<ValidationRuleResult> {
    const workspaceRoot = resolve(context.workspacePath);
    const filesEvaluated: string[] = [];
    const errors: ValidationError[] = [];

    if (!context.history) {
      return { passed: true, filesEvaluated, errors };
    }

    const generationRecords = context.history
      .getRecords()
      .filter(
        (record) =>
          record.operation === 'GENERATE_FUNCTION' ||
          record.before.length === 0,
      );

    for (const record of generationRecords) {
      const pathsToCheck = [
        ...record.generatedFiles,
        record.file.startsWith(workspaceRoot)
          ? record.file.replace(`${workspaceRoot}/`, '')
          : record.file,
      ];

      for (const relativePath of [...new Set(pathsToCheck)]) {
        if (!relativePath || relativePath.startsWith('/')) {
          continue;
        }

        const absolutePath = join(workspaceRoot, relativePath);
        filesEvaluated.push(relativePath);

        try {
          await access(absolutePath);
        } catch {
          errors.push(
            new ValidationError({
              ruleId: this.id,
              ruleName: this.name,
              message: `Function o archivo generado inaccesible: ${relativePath}`,
              files: [relativePath],
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
