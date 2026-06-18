import type { RiskLevel } from '../report/RiskLevel.js';

export interface RewriteApplication {
  before: string;
  after: string;
  ruleId: string;
  ruleName: string;
  reason: string;
  benefit: string;
  riskLevel: RiskLevel;
  templateUsed: string;
  relatedFiles: string[];
}
