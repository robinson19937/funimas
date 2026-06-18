import type { SemanticContext } from './SemanticContext.js';
import type { SemanticOperation } from './SemanticOperation.js';
import type { SemanticRule } from './SemanticRule.js';

export class RuleRegistry {
  private readonly rules: SemanticRule[] = [];

  register(rule: SemanticRule): void {
    this.rules.push(rule);
  }

  registerMany(rules: SemanticRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  getRules(): SemanticRule[] {
    return [...this.rules];
  }

  async runAll(context: SemanticContext): Promise<SemanticOperation[]> {
    const operations: SemanticOperation[] = [];

    for (const rule of this.rules) {
      const ruleOperations = await rule.analyze(context);
      operations.push(...ruleOperations);
    }

    return operations;
  }
}
