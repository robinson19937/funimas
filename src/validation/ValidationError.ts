export interface ValidationErrorData {
  ruleId: string;
  ruleName: string;
  message: string;
  files: string[];
  transformationId?: string;
}

export class ValidationError {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly message: string;
  readonly files: string[];
  readonly transformationId?: string;

  constructor(data: ValidationErrorData) {
    this.ruleId = data.ruleId;
    this.ruleName = data.ruleName;
    this.message = data.message;
    this.files = [...data.files];
    this.transformationId = data.transformationId;
  }

  toJSON(): ValidationErrorData {
    return {
      ruleId: this.ruleId,
      ruleName: this.ruleName,
      message: this.message,
      files: [...this.files],
      transformationId: this.transformationId,
    };
  }
}
