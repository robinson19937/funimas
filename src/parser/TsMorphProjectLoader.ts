import { access } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';

import { Project } from 'ts-morph';

import { isExcludedEntry } from '../utils/project-fs.js';

export const SOURCE_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const;

export type SourceFileExtension = (typeof SOURCE_FILE_EXTENSIONS)[number];

export class TsMorphProjectLoader {
  async load(projectPath: string): Promise<Project> {
    const tsConfigFilePath = await this.findTsConfigFile(projectPath);

    if (tsConfigFilePath) {
      return new Project({
        tsConfigFilePath,
      });
    }

    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true,
      },
    });

    const sourceFilePaths = await this.collectSourceFiles(projectPath);

    for (const sourceFilePath of sourceFilePaths) {
      project.addSourceFileAtPath(sourceFilePath);
    }

    return project;
  }

  getIncludedSourceFiles(project: Project): ReturnType<Project['getSourceFiles']> {
    return project
      .getSourceFiles()
      .filter((sourceFile) => this.shouldIncludeSourceFile(sourceFile.getFilePath()));
  }

  private async findTsConfigFile(projectPath: string): Promise<string | undefined> {
    const tsConfigFilePath = join(projectPath, 'tsconfig.json');

    try {
      await access(tsConfigFilePath);
      return tsConfigFilePath;
    } catch {
      return undefined;
    }
  }

  private async collectSourceFiles(rootDir: string): Promise<string[]> {
    const sourceFiles: string[] = [];

    const walk = async (currentDir: string): Promise<void> => {
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (isExcludedEntry(entry.name)) {
          continue;
        }

        const entryPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await walk(entryPath);
          continue;
        }

        if (entry.isFile() && this.isSupportedExtension(extname(entry.name))) {
          sourceFiles.push(entryPath);
        }
      }
    };

    await walk(rootDir);

    return sourceFiles;
  }

  private shouldIncludeSourceFile(filePath: string): boolean {
    if (!this.isSupportedExtension(extname(filePath))) {
      return false;
    }

    return !filePath.split(sep).some((segment) => isExcludedEntry(segment));
  }

  private isSupportedExtension(extension: string): extension is SourceFileExtension {
    return (SOURCE_FILE_EXTENSIONS as readonly string[]).includes(extension);
  }
}
