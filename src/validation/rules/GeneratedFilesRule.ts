import { access } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

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
        this.toWorkspaceRelativePath(workspaceRoot, record.file),
      ].filter((path): path is string => Boolean(path));

      for (const relativePath of [...new Set(pathsToCheck)]) {
        const absolutePath = isAbsolute(relativePath)
          ? resolve(relativePath)
          : join(workspaceRoot, relativePath);
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

  private toWorkspaceRelativePath(workspaceRoot: string, filePath: string): string | undefined {
    if (!filePath) {
      return undefined;
    }

    const normalizedRoot = resolve(workspaceRoot);
    const normalizedPath = resolve(filePath);

    if (normalizedPath === normalizedRoot) {
      return undefined;
    }

    const normalizedRootLower = normalizedRoot.toLowerCase();
    const normalizedPathLower = normalizedPath.toLowerCase();

    if (
      normalizedPathLower.startsWith(`${normalizedRootLower}\\`) ||
      normalizedPathLower.startsWith(`${normalizedRootLower}/`)
    ) {
      return relative(normalizedRoot, normalizedPath);
    }

    if (!isAbsolute(filePath)) {
      return filePath;
    }

    return undefined;
  }
}
