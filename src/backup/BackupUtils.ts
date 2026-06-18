import { join } from 'node:path';

import {
  ProjectFsError,
  assertProjectDirectoryExists as assertProjectDirectoryExistsBase,
  copyProjectContents,
  ensureDirectory,
  EXCLUDED_ENTRIES,
  isExcludedEntry,
} from '../utils/project-fs.js';

export {
  EXCLUDED_ENTRIES,
  copyProjectContents,
  ensureDirectory,
  isExcludedEntry,
};

export class BackupError extends ProjectFsError {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export async function assertProjectDirectoryExists(projectPath: string): Promise<void> {
  try {
    await assertProjectDirectoryExistsBase(projectPath);
  } catch (error) {
    if (error instanceof ProjectFsError) {
      throw new BackupError(error.message);
    }

    throw error;
  }
}

export function formatBackupTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-').concat(
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`,
  );
}

export function getRelativeBackupPath(timestamp: string): string {
  return join('.funimas', 'backups', timestamp);
}
