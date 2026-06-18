import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';

import {
  type FunctionDeclaration,
  type MethodDeclaration,
  type SourceFile,
  SyntaxKind,
} from 'ts-morph';

import type { AstProject } from '../parser/AstProject.js';
import { TsMorphProjectLoader } from '../parser/TsMorphProjectLoader.js';

import { ClassInfo } from './ClassInfo.js';
import { EnumInfo } from './EnumInfo.js';
import { ExportInfo } from './ExportInfo.js';
import { FileInfo } from './FileInfo.js';
import { FunctionInfo } from './FunctionInfo.js';
import { ImportInfo } from './ImportInfo.js';
import { InterfaceInfo } from './InterfaceInfo.js';
import { PropertyInfo } from './PropertyInfo.js';
import { ScanResult } from './ScanResult.js';
import type { SourceLocation } from './SourceLocation.js';
import { VariableInfo } from './VariableInfo.js';

export interface ProjectScannerService {
  scan(astProject: AstProject): Promise<ScanResult>;
}

export interface ProjectScannerOptions {
  now?: () => Date;
  projectLoader?: TsMorphProjectLoader;
}

export class ProjectScanner implements ProjectScannerService {
  private readonly now: () => Date;
  private readonly projectLoader: TsMorphProjectLoader;

  constructor(options: ProjectScannerOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.projectLoader = options.projectLoader ?? new TsMorphProjectLoader();
  }

  async scan(astProject: AstProject): Promise<ScanResult> {
    const startedAt = this.now();
    const morphProject = await this.projectLoader.load(astProject.projectPath);
    const sourceFiles = this.projectLoader.getIncludedSourceFiles(morphProject);

    const files: FileInfo[] = [];

    for (const sourceFile of sourceFiles) {
      files.push(await this.scanSourceFile(sourceFile));
    }

    const finishedAt = this.now();

    return new ScanResult({
      projectPath: astProject.projectPath,
      files,
      totalFiles: files.length,
      totalImports: this.sum(files, (file) => file.imports.length),
      totalFunctions: this.sum(files, (file) => file.functions.length),
      totalClasses: this.sum(files, (file) => file.classes.length),
      totalInterfaces: this.sum(files, (file) => file.interfaces.length),
      totalEnums: this.sum(files, (file) => file.enums.length),
      totalVariables: this.sum(files, (file) => file.variables.length),
      startedAt,
      finishedAt,
    });
  }

  private async scanSourceFile(sourceFile: SourceFile): Promise<FileInfo> {
    const filePath = sourceFile.getFilePath();
    const fileStats = await stat(filePath);
    const functions = this.extractFunctions(sourceFile);
    const classes = this.extractClasses(sourceFile);
    const interfaces = this.extractInterfaces(sourceFile);
    const enums = this.extractEnums(sourceFile);
    const variables = this.extractVariables(sourceFile);
    const imports = this.extractImports(sourceFile);
    const exports = this.extractExports(sourceFile);

    return new FileInfo({
      path: filePath,
      name: basename(filePath),
      extension: extname(filePath),
      size: fileStats.size,
      lineCount: sourceFile.getEndLineNumber(),
      imports,
      exports,
      functions,
      classes,
      interfaces,
      enums,
      variables,
    });
  }

  private extractImports(sourceFile: SourceFile): ImportInfo[] {
    const imports = sourceFile.getImportDeclarations().map((importDeclaration) => {
      return new ImportInfo({
        moduleSpecifier: importDeclaration.getModuleSpecifierValue() ?? '',
        namedImports: importDeclaration.getNamedImports().map((namedImport) => {
          return namedImport.getName();
        }),
        defaultImport: importDeclaration.getDefaultImport()?.getText(),
        namespaceImport: importDeclaration.getNamespaceImport()?.getText(),
      });
    });

    const importEqualsDeclarations = sourceFile
      .getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration)
      .map((importEqualsDeclaration) => {
        return new ImportInfo({
          moduleSpecifier: this.getImportEqualsModuleSpecifier(importEqualsDeclaration.getText()),
          namedImports: [],
          namespaceImport: importEqualsDeclaration.getName(),
        });
      });

    return [...imports, ...importEqualsDeclarations];
  }

  private extractFunctions(sourceFile: SourceFile): FunctionInfo[] {
    const topLevelFunctions = sourceFile
      .getFunctions()
      .map((functionDeclaration) => this.mapFunctionDeclaration(functionDeclaration));

    const classMethods = sourceFile
      .getClasses()
      .flatMap((classDeclaration) => classDeclaration.getMethods())
      .map((methodDeclaration) => this.mapMethodDeclaration(methodDeclaration));

    return [...topLevelFunctions, ...classMethods];
  }

  private extractClasses(sourceFile: SourceFile): ClassInfo[] {
    return sourceFile.getClasses().map((classDeclaration) => {
      return new ClassInfo({
        name: classDeclaration.getName() ?? 'anonymous',
        methods: classDeclaration
          .getMethods()
          .map((methodDeclaration) => this.mapMethodDeclaration(methodDeclaration)),
        properties: classDeclaration.getProperties().map((propertyDeclaration) => {
          return new PropertyInfo({
            name: propertyDeclaration.getName(),
            type: this.getTypeText(propertyDeclaration),
          });
        }),
        extendsClass: classDeclaration.getExtends()?.getText(),
        implementsInterfaces: classDeclaration.getImplements().map((implemented) => {
          return implemented.getText();
        }),
      });
    });
  }

  private extractInterfaces(sourceFile: SourceFile): InterfaceInfo[] {
    return sourceFile.getInterfaces().map((interfaceDeclaration) => {
      return new InterfaceInfo({
        name: interfaceDeclaration.getName(),
        properties: interfaceDeclaration.getProperties().map((propertySignature) => {
          return new PropertyInfo({
            name: propertySignature.getName(),
            type: this.getTypeText(propertySignature),
          });
        }),
      });
    });
  }

  private extractEnums(sourceFile: SourceFile): EnumInfo[] {
    return sourceFile.getEnums().map((enumDeclaration) => {
      return new EnumInfo({
        name: enumDeclaration.getName(),
        values: enumDeclaration.getMembers().map((enumMember) => enumMember.getName()),
      });
    });
  }

  private extractVariables(sourceFile: SourceFile): VariableInfo[] {
    return sourceFile.getVariableDeclarations().flatMap((variableDeclaration) => {
      const variableStatement = variableDeclaration.getVariableStatement();

      if (!variableStatement?.isExported()) {
        return [];
      }

      return [
        new VariableInfo({
          name: variableDeclaration.getName(),
          type: this.getTypeText(variableDeclaration),
          isExported: true,
        }),
      ];
    });
  }

  private extractExports(sourceFile: SourceFile): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const functionDeclaration of sourceFile.getFunctions()) {
      if (functionDeclaration.isExported()) {
        exports.push(
          new ExportInfo({
            name: functionDeclaration.getName() ?? 'anonymous',
            kind: 'function',
          }),
        );
      }
    }

    for (const classDeclaration of sourceFile.getClasses()) {
      if (classDeclaration.isExported()) {
        exports.push(
          new ExportInfo({
            name: classDeclaration.getName() ?? 'anonymous',
            kind: 'class',
          }),
        );
      }
    }

    for (const interfaceDeclaration of sourceFile.getInterfaces()) {
      if (interfaceDeclaration.isExported()) {
        exports.push(
          new ExportInfo({
            name: interfaceDeclaration.getName(),
            kind: 'interface',
          }),
        );
      }
    }

    for (const enumDeclaration of sourceFile.getEnums()) {
      if (enumDeclaration.isExported()) {
        exports.push(
          new ExportInfo({
            name: enumDeclaration.getName(),
            kind: 'enum',
          }),
        );
      }
    }

    for (const variableDeclaration of sourceFile.getVariableDeclarations()) {
      const variableStatement = variableDeclaration.getVariableStatement();

      if (variableStatement?.isExported()) {
        exports.push(
          new ExportInfo({
            name: variableDeclaration.getName(),
            kind: 'variable',
          }),
        );
      }
    }

    return exports;
  }

  private mapFunctionDeclaration(functionDeclaration: FunctionDeclaration): FunctionInfo {
    return new FunctionInfo({
      name: functionDeclaration.getName() ?? 'anonymous',
      parameters: functionDeclaration.getParameters().map((parameter) => parameter.getText()),
      isAsync: functionDeclaration.isAsync(),
      isExported: functionDeclaration.isExported(),
      location: this.getSourceLocation(functionDeclaration),
    });
  }

  private mapMethodDeclaration(methodDeclaration: MethodDeclaration): FunctionInfo {
    return new FunctionInfo({
      name: methodDeclaration.getName(),
      parameters: methodDeclaration.getParameters().map((parameter) => parameter.getText()),
      isAsync: methodDeclaration.isAsync(),
      isExported: false,
      location: this.getSourceLocation(methodDeclaration),
    });
  }

  private getSourceLocation(node: { getStart(): number; getSourceFile(): SourceFile }): SourceLocation {
    const sourceFile = node.getSourceFile();
    const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());

    return {
      filePath: sourceFile.getFilePath(),
      line,
      column,
    };
  }

  private getTypeText(node: {
    getTypeNode(): { getText(): string } | undefined;
    getType(): { getText(): string };
  }): string | undefined {
    return node.getTypeNode()?.getText() ?? node.getType().getText();
  }

  private getImportEqualsModuleSpecifier(importEqualsText: string): string {
    const match = importEqualsText.match(/require\((['"])(.*?)\1\)/);

    return match?.[2] ?? importEqualsText;
  }

  private sum<T>(items: T[], selector: (item: T) => number): number {
    return items.reduce((total, item) => total + selector(item), 0);
  }
}
