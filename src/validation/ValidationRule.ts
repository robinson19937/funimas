import type { ValidationContext } from './ValidationContext.js';
import type { ValidationError } from './ValidationError.js';

export interface ValidationRuleResult {
  passed: boolean;
  filesEvaluated: string[];
  errors: ValidationError[];
}

export interface ValidationRule {
  readonly id: string;
  readonly name: string;
  validate(context: ValidationContext): Promise<ValidationRuleResult>;
}
