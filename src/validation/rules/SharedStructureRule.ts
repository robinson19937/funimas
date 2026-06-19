import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { SHARED_FILE_DEFINITIONS } from '../../runtime/RuntimeGenerator.js';
import type { ValidationContext } from '../ValidationContext.js';
import { ValidationError } from '../ValidationError.js';
import type { ValidationRule, ValidationRuleResult } from '../ValidationRule.js';

export class SharedStructureRule implements ValidationRule {
  readonly id = 'shared-structure';
  readonly name = 'Shared';

  async validate(context: ValidationContext): Promise<ValidationRuleResult> {
    const hasSharedGeneration = context.history
      ?.getRecords()
      .some((record) => record.operation === 'GENERATE_SHARED');

    if (!hasSharedGeneration) {
      return { passed: true, filesEvaluated: [], errors: [] };
    }

    const filesEvaluated: string[] = [];
    const errors: ValidationError[] = [];

    for (const definition of SHARED_FILE_DEFINITIONS) {
      const absolutePath = join(context.workspacePath, definition.outputPath);
      filesEvaluated.push(definition.outputPath);

      try {
        await access(absolutePath);
      } catch {
        errors.push(
          new ValidationError({
            ruleId: this.id,
            ruleName: this.name,
            message: `Archivo shared faltante: ${definition.outputPath}`,
            files: [definition.outputPath],
          }),
        );
      }
    }

    return {
      passed: errors.length === 0,
      filesEvaluated,
      errors,
    };
  }
}
