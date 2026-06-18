import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

export class GenerationVerificationError extends Error {
  readonly generatorName: string;
  readonly relativePath: string;
  readonly absolutePath: string;

  constructor(
    generatorName: string,
    relativePath: string,
    absolutePath: string,
    detail?: string,
  ) {
    const suffix = detail ? ` (${detail})` : '';
    super(
      `Error de generación [${generatorName}]: el archivo "${relativePath}" no existe en disco después de la escritura${suffix}`,
    );
    this.name = 'GenerationVerificationError';
    this.generatorName = generatorName;
    this.relativePath = relativePath;
    this.absolutePath = absolutePath;
  }
}

export interface VerifiableWrittenFile {
  relativePath: string;
  absolutePath: string;
  content: string;
}

/**
 * Verifica que los archivos reportados como generados existan realmente en disco.
 */
export class GeneratedFileVerifier {
  async verifyExists(
    workspacePath: string,
    relativePath: string,
    generatorName: string,
  ): Promise<string> {
    const workspaceRoot = resolve(workspacePath);
    const absolutePath = resolve(workspaceRoot, relativePath);

    if (!absolutePath.startsWith(workspaceRoot)) {
      throw new GenerationVerificationError(
        generatorName,
        relativePath,
        absolutePath,
        'ruta fuera del workspace',
      );
    }

    try {
      await access(absolutePath, constants.F_OK);
    } catch {
      throw new GenerationVerificationError(generatorName, relativePath, absolutePath);
    }

    return absolutePath;
  }

  async verifyContent(
    absolutePath: string,
    expectedContent: string,
    relativePath: string,
    generatorName: string,
  ): Promise<void> {
    const onDisk = await readFile(absolutePath, 'utf8');

    if (onDisk !== expectedContent) {
      throw new GenerationVerificationError(
        generatorName,
        relativePath,
        absolutePath,
        'el contenido en disco no coincide con el generado',
      );
    }
  }

  async verifyWrittenFile(
    workspacePath: string,
    file: VerifiableWrittenFile,
    generatorName: string,
  ): Promise<void> {
    const absolutePath = await this.verifyExists(workspacePath, file.relativePath, generatorName);

    if (resolve(absolutePath) !== resolve(file.absolutePath)) {
      throw new GenerationVerificationError(
        generatorName,
        file.relativePath,
        file.absolutePath,
        'ruta absoluta reportada no coincide',
      );
    }

    await this.verifyContent(absolutePath, file.content, file.relativePath, generatorName);
  }

  async verifyWrittenFiles(
    workspacePath: string,
    files: VerifiableWrittenFile[],
    generatorName: string,
  ): Promise<void> {
    for (const file of files) {
      await this.verifyWrittenFile(workspacePath, file, generatorName);
    }
  }

  async verifyPaths(
    workspacePath: string,
    relativePaths: string[],
    generatorName: string,
  ): Promise<void> {
    for (const relativePath of relativePaths) {
      await this.verifyExists(workspacePath, relativePath, generatorName);
    }
  }
}
