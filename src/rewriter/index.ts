export { CodeRewriter, createDefaultRewriteRegistry, type CodeRewriterOptions, type CodeRewriterService } from './CodeRewriter.js';
export {
  FirebaseAuthConfigurator,
  type FirebaseAuthConfigurationResult,
} from './FirebaseAuthConfigurator.js';
export { Formatter } from './Formatter.js';
export { ImportManager } from './ImportManager.js';
export { RewriteContext, type RewriteContextData } from './RewriteContext.js';
export { RewriteRegistry } from './RewriteRegistry.js';
export {
  RewriteResult,
  createEmptyOperationsRewritten,
  type RewriteResultData,
} from './RewriteResult.js';
export type { RewriteRule } from './RewriteRule.js';
export type { RewriteApplication } from './RewriteApplication.js';
export { DatabaseInsertRewriteRule } from './rules/DatabaseInsertRewriteRule.js';
export { DatabaseSetRewriteRule } from './rules/DatabaseSetRewriteRule.js';
export { DatabaseUpdateRewriteRule } from './rules/DatabaseUpdateRewriteRule.js';
export { DatabaseDeleteRewriteRule } from './rules/DatabaseDeleteRewriteRule.js';
export { DatabaseReadRewriteRule } from './rules/DatabaseReadRewriteRule.js';
export { DatabaseSubscribeRewriteRule } from './rules/DatabaseSubscribeRewriteRule.js';
export { extractCollectionName, findCallExpressionAt } from './rewrite-utils.js';
export {
  extractCollectionArgument,
  extractDocParts,
  extractDocReference,
  extractSnapshotCallback,
  extractSnapshotTarget,
} from './firestore-rewrite-utils.js';
