import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { GeneratedFile } from '../adapters/GeneratedFile.js';

export class GeneratorFileWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeneratorFileWriterError';
  }
}

export interface WrittenFile extends GeneratedFile {
  absolutePath: string;
}

/**
 * Escribe archivos generados exclusivamente dentro del workspace.
 */
export class GeneratorFileWriter {
  async writeFile(workspacePath: string, file: GeneratedFile): Promise<WrittenFile> {
    const workspaceRoot = resolve(workspacePath);
    const absolutePath = resolve(workspaceRoot, file.relativePath);

    if (!absolutePath.startsWith(workspaceRoot)) {
      throw new GeneratorFileWriterError(
        `No se puede escribir fuera del workspace: ${file.relativePath}`,
      );
    }

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, 'utf8');

    return {
      ...file,
      absolutePath,
    };
  }

  async writeFiles(workspacePath: string, files: GeneratedFile[]): Promise<WrittenFile[]> {
    const written: WrittenFile[] = [];

    for (const file of files) {
      written.push(await this.writeFile(workspacePath, file));
    }

    return written;
  }
}
