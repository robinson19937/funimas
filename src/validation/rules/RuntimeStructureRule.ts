import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { RUNTIME_FILE_DEFINITIONS } from '../../runtime/RuntimeGenerator.js';
import type { ValidationContext } from '../ValidationContext.js';
import { ValidationError } from '../ValidationError.js';
import type { ValidationRule, ValidationRuleResult } from '../ValidationRule.js';

export class RuntimeStructureRule implements ValidationRule {
  readonly id = 'runtime-structure';
  readonly name = 'Runtime';

  async validate(context: ValidationContext): Promise<ValidationRuleResult> {
    const hasRuntimeGeneration = context.history
      ?.getRecords()
      .some((record) => record.operation === 'GENERATE_RUNTIME');

    if (!hasRuntimeGeneration) {
      return { passed: true, filesEvaluated: [], errors: [] };
    }

    const filesEvaluated: string[] = [];
    const errors: ValidationError[] = [];

    for (const definition of RUNTIME_FILE_DEFINITIONS) {
      const absolutePath = join(context.workspacePath, definition.outputPath);
      filesEvaluated.push(definition.outputPath);

      try {
        await access(absolutePath);
      } catch {
        const record = context.history
          ?.getRecords()
          .find((entry) => entry.operation === 'GENERATE_RUNTIME');

        errors.push(
          new ValidationError({
            ruleId: this.id,
            ruleName: this.name,
            message: `Archivo de runtime faltante: ${definition.outputPath}`,
            files: [definition.outputPath],
            transformationId: record?.id,
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
