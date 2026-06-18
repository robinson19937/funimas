import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const EXCLUDED_ENTRIES = [
  'node_modules',
  '.git',
  '.funimas',
  'dist',
  'coverage',
] as const;

export type ExcludedEntry = (typeof EXCLUDED_ENTRIES)[number];

export class ProjectFsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFsError';
  }
}

export function isExcludedEntry(name: string): name is ExcludedEntry {
  return (EXCLUDED_ENTRIES as readonly string[]).includes(name);
}

export async function assertProjectDirectoryExists(projectPath: string): Promise<void> {
  try {
    const projectStats = await stat(projectPath);

    if (!projectStats.isDirectory()) {
      throw new ProjectFsError(`La ruta no es un directorio: ${projectPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ProjectFsError(`El proyecto no existe: ${projectPath}`);
    }

    throw error;
  }
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function copyProjectContents(
  sourceDir: string,
  destinationDir: string,
): Promise<number> {
  await ensureDirectory(destinationDir);

  const entries = await readdir(sourceDir, { withFileTypes: true });
  let filesCopied = 0;

  for (const entry of entries) {
    if (isExcludedEntry(entry.name)) {
      continue;
    }

    const sourcePath = join(sourceDir, entry.name);
    const destinationPath = join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      filesCopied += await copyProjectContents(sourcePath, destinationPath);
      continue;
    }

    if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
      filesCopied += 1;
    }
  }

  return filesCopied;
}
