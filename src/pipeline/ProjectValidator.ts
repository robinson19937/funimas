import { resolve } from 'node:path';

import { assertProjectDirectoryExists, ProjectFsError } from '../utils/project-fs.js';

export interface ProjectValidationResult {
  valid: true;
  projectPath: string;
}

export class ProjectValidator {
  async validate(projectPath: string): Promise<ProjectValidationResult> {
    const resolvedPath = resolve(projectPath);

    await assertProjectDirectoryExists(resolvedPath);

    return {
      valid: true,
      projectPath: resolvedPath,
    };
  }
}

export { ProjectFsError };
