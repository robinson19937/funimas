import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { GeneratedFile } from '../adapters/GeneratedFile.js';
import { GeneratedFileVerifier } from './GeneratedFileVerifier.js';

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
export interface GeneratorFileWriterOptions {
  verifier?: GeneratedFileVerifier;
  generatorName?: string;
}

export class GeneratorFileWriter {
  private readonly verifier: GeneratedFileVerifier;
  private readonly generatorName: string;

  constructor(options: GeneratorFileWriterOptions = {}) {
    this.verifier = options.verifier ?? new GeneratedFileVerifier();
    this.generatorName = options.generatorName ?? 'GeneratorFileWriter';
  }

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

    const written: WrittenFile = {
      ...file,
      absolutePath,
    };

    await this.verifier.verifyWrittenFile(workspacePath, written, this.generatorName);

    return written;
  }

  async writeFiles(workspacePath: string, files: GeneratedFile[]): Promise<WrittenFile[]> {
    const written: WrittenFile[] = [];

    for (const file of files) {
      written.push(await this.writeFile(workspacePath, file));
    }

    return written;
  }
}
