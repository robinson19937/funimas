import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { GeneratedFile } from '../adapters/GeneratedFile.js';
import { GeneratorFileWriter } from './GeneratorFileWriter.js';
import type { GeneratorContext } from './GeneratorContext.js';
import { renderFirebaseAdminTypes, renderNetlifyTypes } from './templates/workspace/netlify-types.js';

const NETLIFY_FUNCTIONS_VERSION = '^2.8.2';

const FUNIMAS_PATHS = {
  '@funimas/sdk': ['./sdk/index.ts'],
  '@funimas/shared': ['./shared/index.ts'],
} as const;

const FUNIMAS_INCLUDES = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  'sdk/**/*',
  'shared/**/*',
  'runtime/**/*',
  'netlify/**/*',
] as const;

const FUNIMAS_EXCLUDES = ['node_modules', '**/node_modules', '.funimas'] as const;

const DEFAULT_COMPILER_OPTIONS: Record<string, unknown> = {
  target: 'ES2022',
  module: 'NodeNext',
  moduleResolution: 'NodeNext',
  strict: true,
  allowJs: true,
  esModuleInterop: true,
  skipLibCheck: true,
  baseUrl: '.',
  paths: FUNIMAS_PATHS,
};

export interface WorkspaceConfigGeneratorOptions {
  fileWriter?: GeneratorFileWriter;
}

export interface WorkspaceConfigResult {
  filesWritten: string[];
  typesRelativePath: string;
}

/**
 * Prepara el workspace con tsconfig, tipos de Netlify y dependencias necesarias
 * para que la validación TypeScript pase en proyectos JS/TS sin configuración previa.
 */
export class WorkspaceConfigGenerator {
  private readonly fileWriter: GeneratorFileWriter;

  constructor(options: WorkspaceConfigGeneratorOptions = {}) {
    this.fileWriter =
      options.fileWriter ?? new GeneratorFileWriter({ generatorName: 'WorkspaceConfigGenerator' });
  }

  async generate(context: GeneratorContext): Promise<WorkspaceConfigResult> {
    const { workspacePath } = context;
    const typesRelativePath = await this.resolveTypesPath(workspacePath);
    const filesWritten: string[] = [];

    const typesFile: GeneratedFile = {
      fileName: 'netlify.d.ts',
      relativePath: typesRelativePath,
      content: renderNetlifyTypes(),
    };

    await this.fileWriter.writeFile(workspacePath, typesFile);
    filesWritten.push(typesRelativePath);

    const firebaseAdminTypesFile: GeneratedFile = {
      fileName: 'firebase-admin.d.ts',
      relativePath: typesRelativePath.replace('netlify.d.ts', 'firebase-admin.d.ts'),
      content: renderFirebaseAdminTypes(),
    };

    await this.fileWriter.writeFile(workspacePath, firebaseAdminTypesFile);
    filesWritten.push(firebaseAdminTypesFile.relativePath);

    await this.ensureTsConfig(workspacePath, typesRelativePath);
    filesWritten.push('tsconfig.json');

    await this.ensurePackageJson(workspacePath);
    filesWritten.push('package.json');

    return { filesWritten, typesRelativePath };
  }

  private async resolveTypesPath(workspacePath: string): Promise<string> {
    try {
      await access(join(workspacePath, 'src'));
      return 'src/types/netlify.d.ts';
    } catch {
      return 'types/netlify.d.ts';
    }
  }

  private async ensureTsConfig(workspacePath: string, typesRelativePath: string): Promise<void> {
    const tsConfigPath = join(workspacePath, 'tsconfig.json');
    const typesDir = typesRelativePath.split('/').slice(0, -1).join('/');
    const includeEntries = new Set<string>([...FUNIMAS_INCLUDES, `${typesDir}/**/*`]);

    let tsConfig: Record<string, unknown>;

    try {
      const existing = JSON.parse(await readFile(tsConfigPath, 'utf8')) as Record<string, unknown>;
      tsConfig = this.mergeTsConfig(existing, typesDir, includeEntries);
    } catch {
      tsConfig = this.createDefaultTsConfig(includeEntries);
    }

    await writeFile(tsConfigPath, `${JSON.stringify(tsConfig, null, 2)}\n`, 'utf8');
  }

  private createDefaultTsConfig(includeEntries: Set<string>): Record<string, unknown> {
    return {
      compilerOptions: {
        ...DEFAULT_COMPILER_OPTIONS,
        types: ['node'],
      },
      include: [...includeEntries],
      exclude: [...FUNIMAS_EXCLUDES],
    };
  }

  private mergeTsConfig(
    existing: Record<string, unknown>,
    typesDir: string,
    includeEntries: Set<string>,
  ): Record<string, unknown> {
    const compilerOptions = {
      ...DEFAULT_COMPILER_OPTIONS,
      ...(typeof existing.compilerOptions === 'object' && existing.compilerOptions !== null
        ? (existing.compilerOptions as Record<string, unknown>)
        : {}),
    };

    const existingPaths =
      typeof compilerOptions.paths === 'object' && compilerOptions.paths !== null
        ? (compilerOptions.paths as Record<string, string[]>)
        : {};

    compilerOptions.paths = {
      ...existingPaths,
      ...FUNIMAS_PATHS,
    };

    if (!compilerOptions.baseUrl) {
      compilerOptions.baseUrl = '.';
    }

    if (compilerOptions.allowJs === undefined) {
      compilerOptions.allowJs = true;
    }

    if (compilerOptions.skipLibCheck === undefined) {
      compilerOptions.skipLibCheck = true;
    }

    if (!compilerOptions.types) {
      compilerOptions.types = ['node'];
    }

    const existingInclude = Array.isArray(existing.include)
      ? existing.include.map(String)
      : ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];

    for (const entry of existingInclude) {
      includeEntries.add(entry);
    }

    includeEntries.add(`${typesDir}/**/*`);

    const existingExclude = Array.isArray(existing.exclude)
      ? existing.exclude.map(String)
      : [];

    const exclude = new Set<string>([...FUNIMAS_EXCLUDES, ...existingExclude]);

    return {
      ...existing,
      compilerOptions,
      include: [...includeEntries],
      exclude: [...exclude],
    };
  }

  private async ensurePackageJson(workspacePath: string): Promise<void> {
    const packageJsonPath = join(workspacePath, 'package.json');
    let packageJson: Record<string, unknown>;

    try {
      packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Record<string, unknown>;
    } catch {
      packageJson = {
        name: 'funimas-protected-workspace',
        private: true,
        version: '1.0.0',
        type: 'module',
      };
    }

    const dependencies =
      typeof packageJson.dependencies === 'object' && packageJson.dependencies !== null
        ? (packageJson.dependencies as Record<string, string>)
        : {};

    if (!dependencies['@netlify/functions']) {
      dependencies['@netlify/functions'] = NETLIFY_FUNCTIONS_VERSION;
    }

    if (!dependencies['firebase-admin']) {
      dependencies['firebase-admin'] = '^13.4.0';
    }

    packageJson.dependencies = dependencies;

    const devDependencies =
      typeof packageJson.devDependencies === 'object' && packageJson.devDependencies !== null
        ? (packageJson.devDependencies as Record<string, string>)
        : {};

    if (!devDependencies['@types/node']) {
      devDependencies['@types/node'] = '^24.0.3';
    }

    packageJson.devDependencies = devDependencies;

    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }
}
