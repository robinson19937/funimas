import { access } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';

import { Project, type SourceFile, SyntaxKind } from 'ts-morph';

import { assertProjectDirectoryExists, isExcludedEntry } from '../utils/project-fs.js';

import { AstParserResult } from './AstParserResult.js';
import { AstProject } from './AstProject.js';
import { AstSourceFile } from './AstSourceFile.js';

export const SOURCE_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const;

export type SourceFileExtension = (typeof SOURCE_FILE_EXTENSIONS)[number];

export interface AstParserService {
  parse(projectPath: string): Promise<AstParserResult>;
}

export interface AstParserOptions {
  now?: () => Date;
}

export class AstParser implements AstParserService {
  private readonly now: () => Date;

  constructor(options: AstParserOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async parse(projectPath: string): Promise<AstParserResult> {
    const startedAt = this.now();
    const resolvedProjectPath = resolve(projectPath);

    await assertProjectDirectoryExists(resolvedProjectPath);

    const tsMorphProject = await this.loadProject(resolvedProjectPath);
    const sourceFiles = tsMorphProject
      .getSourceFiles()
      .filter((sourceFile) => this.shouldIncludeSourceFile(sourceFile.getFilePath()))
      .map((sourceFile) => this.mapSourceFile(sourceFile));

    const totalTypescriptFiles = sourceFiles.filter((file) =>
      this.isTypescriptExtension(file.extension),
    ).length;
    const totalJavascriptFiles = sourceFiles.filter((file) =>
      this.isJavascriptExtension(file.extension),
    ).length;

    const project = new AstProject({
      projectPath: resolvedProjectPath,
      totalFiles: sourceFiles.length,
      totalTypescriptFiles,
      totalJavascriptFiles,
      sourceFiles,
    });

    const finishedAt = this.now();

    return new AstParserResult({
      project,
      startedAt,
      finishedAt,
    });
  }

  private async loadProject(projectPath: string): Promise<Project> {
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

  private isTypescriptExtension(extension: string): boolean {
    return extension === '.ts' || extension === '.tsx';
  }

  private isJavascriptExtension(extension: string): boolean {
    return extension === '.js' || extension === '.jsx';
  }

  private mapSourceFile(sourceFile: SourceFile): AstSourceFile {
    const filePath = sourceFile.getFilePath();

    return new AstSourceFile({
      path: filePath,
      name: basename(filePath),
      extension: extname(filePath),
      importCount: this.countImports(sourceFile),
      functionCount: this.countFunctions(sourceFile),
      classCount: sourceFile.getClasses().length,
    });
  }

  private countImports(sourceFile: SourceFile): number {
    return (
      sourceFile.getImportDeclarations().length +
      sourceFile.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration).length
    );
  }

  private countFunctions(sourceFile: SourceFile): number {
    return (
      sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).length +
      sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration).length
    );
  }
}
