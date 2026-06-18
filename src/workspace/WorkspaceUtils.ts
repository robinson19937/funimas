import { access } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import {
  ProjectFsError,
  assertProjectDirectoryExists as assertProjectDirectoryExistsBase,
} from '../utils/project-fs.js';

export const WORKSPACE_SUFFIX = '_funimas';

export class WorkspaceError extends ProjectFsError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export async function assertProjectDirectoryExists(projectPath: string): Promise<void> {
  try {
    await assertProjectDirectoryExistsBase(projectPath);
  } catch (error) {
    if (error instanceof ProjectFsError) {
      throw new WorkspaceError(error.message);
    }

    throw error;
  }
}

export function getWorkspaceProjectPath(projectPath: string): string {
  const resolvedProjectPath = resolve(projectPath);
  const projectName = basename(resolvedProjectPath);

  return resolve(dirname(resolvedProjectPath), `${projectName}${WORKSPACE_SUFFIX}`);
}

export async function assertWorkspaceDoesNotExist(workspacePath: string): Promise<void> {
  try {
    await access(workspacePath);
    throw new WorkspaceError(`El workspace ya existe: ${workspacePath}`);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }

    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }

    throw error;
  }
}
