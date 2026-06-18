import type { SemanticOperation } from '../semantic/SemanticOperation.js';

import type { RewriteRule } from './RewriteRule.js';

export class RewriteRegistry {
  private readonly rules: RewriteRule[] = [];

  register(rule: RewriteRule): void {
    this.rules.push(rule);
  }

  registerMany(rules: RewriteRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  getRules(): RewriteRule[] {
    return [...this.rules];
  }

  findRule(operation: SemanticOperation): RewriteRule | undefined {
    return this.rules.find((rule) => rule.canApply(operation));
  }
}
