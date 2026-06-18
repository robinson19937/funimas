import { basename, extname, resolve } from 'node:path';

import { type SourceFile, SyntaxKind } from 'ts-morph';

import { assertProjectDirectoryExists } from '../utils/project-fs.js';

import { AstParserResult } from './AstParserResult.js';
import { AstProject } from './AstProject.js';
import { AstSourceFile } from './AstSourceFile.js';
import { TsMorphProjectLoader } from './TsMorphProjectLoader.js';

export interface AstParserService {
  parse(projectPath: string): Promise<AstParserResult>;
}

export interface AstParserOptions {
  now?: () => Date;
  projectLoader?: TsMorphProjectLoader;
}

export class AstParser implements AstParserService {
  private readonly now: () => Date;
  private readonly projectLoader: TsMorphProjectLoader;

  constructor(options: AstParserOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.projectLoader = options.projectLoader ?? new TsMorphProjectLoader();
  }

  async parse(projectPath: string): Promise<AstParserResult> {
    const startedAt = this.now();
    const resolvedProjectPath = resolve(projectPath);

    await assertProjectDirectoryExists(resolvedProjectPath);

    const tsMorphProject = await this.projectLoader.load(resolvedProjectPath);
    const sourceFiles = this.projectLoader
      .getIncludedSourceFiles(tsMorphProject)
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

  private isTypescriptExtension(extension: string): boolean {
    return extension === '.ts' || extension === '.tsx';
  }

  private isJavascriptExtension(extension: string): boolean {
    return extension === '.js' || extension === '.jsx';
  }
}
