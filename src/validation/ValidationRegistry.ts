import type { ValidationRule } from './ValidationRule.js';

export class ValidationRegistry {
  private readonly rules: ValidationRule[] = [];

  register(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  registerMany(rules: ValidationRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  getRules(): ValidationRule[] {
    return [...this.rules];
  }
}
