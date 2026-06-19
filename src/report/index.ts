export {
  ChangeReportGenerator,
  type ChangeReportGeneratorOptions,
  type ChangeReportResult,
  type ChangeReportSummary,
} from './ChangeReportGenerator.js';
export {
  buildChangeReportViewModel,
  type ChangeReportViewModel,
  type ReportFileChanges,
  type ReportRewriteChange,
} from './change-report-builder.js';
export {
  ValidationReportGenerator,
  type ValidationReportGeneratorOptions,
  type ValidationReportResult,
  type ValidationReportSummary,
} from './ValidationReportGenerator.js';
export {
  analyzeUntransformedOperations,
  hasBlockingUntransformedOperations,
  type UntransformedOperationFinding,
  type UntransformedReason,
} from './untransformed-operations-analyzer.js';
export { RISK_LEVELS, isRiskLevel, type RiskLevel } from './RiskLevel.js';
export { TransformationBenefit, DATABASE_INSERT_BENEFITS } from './TransformationBenefit.js';
export { TransformationReason, DATABASE_INSERT_REASON } from './TransformationReason.js';
