import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sampleProjectPath = join(fixturesDir, 'sample-project');

describe('ProjectScanner', () => {
  it('construye un índice completo del proyecto a partir del AstProject', async () => {
    const parser = new AstParser();
    const scanner = new ProjectScanner({
      now: () => new Date(2026, 5, 18, 14, 35, 22),
    });

    const parseResult = await parser.parse(sampleProjectPath);
    const scanResult = await scanner.scan(parseResult.project);

    expect(scanResult.projectPath).toBe(sampleProjectPath);
    expect(scanResult.totalFiles).toBe(6);
    expect(scanResult.totalImports).toBeGreaterThan(0);
    expect(scanResult.totalClasses).toBe(2);
    expect(scanResult.totalInterfaces).toBe(1);
    expect(scanResult.totalEnums).toBe(1);
    expect(scanResult.totalVariables).toBe(1);
    expect(scanResult.duration).toBe(0);

    const appFile = scanResult.files.find((file) => file.name === 'app.ts');
    const userInterfaceFile = scanResult.files.find((file) => file.name === 'user.ts');
    const statusEnumFile = scanResult.files.find((file) => file.name === 'status.ts');
    const configFile = scanResult.files.find((file) => file.name === 'config.ts');

    expect(appFile).toMatchObject({
      extension: '.ts',
      lineCount: expect.any(Number),
      size: expect.any(Number),
    });
    expect(appFile?.imports[0]).toMatchObject({
      moduleSpecifier: './services/user-service.js',
      namedImports: ['UserService'],
    });
    expect(appFile?.classes[0]).toMatchObject({
      name: 'App',
      implementsInterfaces: [],
    });
    expect(appFile?.functions.some((fn) => fn.name === 'bootstrap' && fn.isExported)).toBe(true);

    expect(userInterfaceFile?.interfaces[0]).toMatchObject({
      name: 'User',
      properties: expect.arrayContaining([
        expect.objectContaining({ name: 'id' }),
        expect.objectContaining({ name: 'name' }),
      ]),
    });

    expect(statusEnumFile?.enums[0]).toMatchObject({
      name: 'Status',
      values: ['Active', 'Inactive'],
    });

    expect(configFile?.variables[0]).toMatchObject({
      name: 'APP_NAME',
      isExported: true,
    });

    expect(scanResult.files.some((file) => file.path.includes('node_modules'))).toBe(false);
    expect(scanResult.files.some((file) => file.path.includes('dist'))).toBe(false);
  });

  it('calcula estadísticas globales consistentes con los archivos indexados', async () => {
    const parser = new AstParser();
    const scanner = new ProjectScanner();
    const parseResult = await parser.parse(sampleProjectPath);
    const scanResult = await scanner.scan(parseResult.project);

    const imports = scanResult.files.reduce((total, file) => total + file.imports.length, 0);
    const functions = scanResult.files.reduce((total, file) => total + file.functions.length, 0);
    const classes = scanResult.files.reduce((total, file) => total + file.classes.length, 0);
    const interfaces = scanResult.files.reduce(
      (total, file) => total + file.interfaces.length,
      0,
    );
    const enums = scanResult.files.reduce((total, file) => total + file.enums.length, 0);
    const variables = scanResult.files.reduce((total, file) => total + file.variables.length, 0);

    expect(scanResult.totalImports).toBe(imports);
    expect(scanResult.totalFunctions).toBe(functions);
    expect(scanResult.totalClasses).toBe(classes);
    expect(scanResult.totalInterfaces).toBe(interfaces);
    expect(scanResult.totalEnums).toBe(enums);
    expect(scanResult.totalVariables).toBe(variables);
  });
});
