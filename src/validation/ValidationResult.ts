import type { ValidationError } from './ValidationError.js';

export interface RuleValidationResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  duration: number;
  filesEvaluated: string[];
  errors: ValidationError[];
}

export interface ValidationResultData {
  valid: boolean;
  ruleResults: RuleValidationResult[];
  errors: ValidationError[];
  failedTransformationIds: string[];
  rolledBackTransformationIds: string[];
  startedAt: Date;
  finishedAt: Date;
}

export class ValidationResult {
  readonly valid: boolean;
  readonly ruleResults: RuleValidationResult[];
  readonly errors: ValidationError[];
  readonly failedTransformationIds: string[];
  readonly rolledBackTransformationIds: string[];
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: ValidationResultData) {
    this.valid = data.valid;
    this.ruleResults = data.ruleResults;
    this.errors = data.errors;
    this.failedTransformationIds = data.failedTransformationIds;
    this.rolledBackTransformationIds = data.rolledBackTransformationIds;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get duration(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
}
