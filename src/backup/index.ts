export { BackupEngine, type BackupEngineOptions, type BackupService } from './BackupEngine.js';
export { BackupResult, type BackupResultData } from './BackupResult.js';
export {
  BackupError,
  EXCLUDED_ENTRIES,
  assertProjectDirectoryExists,
  copyProjectContents,
  formatBackupTimestamp,
  getRelativeBackupPath,
  isExcludedEntry,
} from './BackupUtils.js';
