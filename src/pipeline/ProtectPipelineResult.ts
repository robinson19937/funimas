import type { PlannerResult } from '../planner/PlannerResult.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';
import type { ValidationResult } from '../validation/ValidationResult.js';
import type { WorkspaceResult } from '../workspace/WorkspaceResult.js';
import type { WorkspaceVerificationReport } from '../verify/index.js';

export interface ProtectPipelineResult {
  success: boolean;
  executionId: string;
  projectPath: string;
  workspaceResult: WorkspaceResult;
  plannerResult: PlannerResult;
  semanticResult: SemanticResult;
  validationResult: ValidationResult;
  verificationReport?: WorkspaceVerificationReport;
  durationMs: number;
  transformationsRegistered: number;
  reportsDirectory: string;
  generationError?: string;
}
