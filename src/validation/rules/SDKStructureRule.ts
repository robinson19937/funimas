import { access } from 'node:fs/promises';
import { join } from 'node:path';

import type { ValidationContext } from '../ValidationContext.js';
import { ValidationError } from '../ValidationError.js';
import type { ValidationRule, ValidationRuleResult } from '../ValidationRule.js';

const REQUIRED_SDK_FILES = ['sdk/index.ts', 'sdk/database/DatabaseClient.ts'];

export class SDKStructureRule implements ValidationRule {
  readonly id = 'sdk-structure';
  readonly name = 'SDK';

  async validate(context: ValidationContext): Promise<ValidationRuleResult> {
    const hasSdkGeneration = context.history
      ?.getRecords()
      .some((record) => record.operation === 'GENERATE_SDK');

    if (!hasSdkGeneration) {
      return { passed: true, filesEvaluated: [], errors: [] };
    }

    const filesEvaluated: string[] = [];
    const errors: ValidationError[] = [];

    for (const relativePath of REQUIRED_SDK_FILES) {
      const absolutePath = join(context.workspacePath, relativePath);
      filesEvaluated.push(relativePath);

      try {
        await access(absolutePath);
      } catch {
        const record = context.history
          ?.getRecords()
          .find((entry) => entry.operation === 'GENERATE_SDK');

        errors.push(
          new ValidationError({
            ruleId: this.id,
            ruleName: this.name,
            message: `Archivo de SDK faltante: ${relativePath}`,
            files: [relativePath],
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
