import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GraphBuilder } from '../src/graph/GraphBuilder.js';
import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';
import { SemanticAnalyzer } from '../src/semantic/SemanticAnalyzer.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const firebaseProjectPath = join(fixturesDir, 'firebase-project');

async function analyzeFirebaseProject() {
  const parser = new AstParser();
  const scanner = new ProjectScanner();
  const graphBuilder = new GraphBuilder();
  const semanticAnalyzer = new SemanticAnalyzer();

  const parseResult = await parser.parse(firebaseProjectPath);
  const scanResult = await scanner.scan(parseResult.project);
  const graphResult = graphBuilder.build(scanResult);

  return semanticAnalyzer.analyze(graphResult);
}

describe('SemanticAnalyzer', () => {
  it('detecta imports y operaciones de Firebase en el proyecto de ejemplo', async () => {
    const result = await analyzeFirebaseProject();

    expect(result.hasProvider('firebase')).toBe(true);
    expect(result.getOperationsByMetadata('category', 'import').length).toBeGreaterThanOrEqual(4);

    const firestoreOps = result.getOperationsByMetadata('category', 'firestore');
    const authOps = result.getOperationsByMetadata('category', 'auth');
    const storageOps = result.getOperationsByMetadata('category', 'storage');

    expect(result.getOperationsByType('DATABASE_INSERT')).toHaveLength(2);
    expect(result.getOperationsByType('DATABASE_UPDATE')).toHaveLength(1);
    expect(result.getOperationsByType('DATABASE_DELETE')).toHaveLength(1);
    expect(result.getOperationsByType('DATABASE_READ')).toHaveLength(2);
    expect(result.getOperationsByType('AUTH_LOGIN')).toHaveLength(1);
    expect(result.getOperationsByType('AUTH_REGISTER')).toHaveLength(1);
    expect(result.getOperationsByType('AUTH_LOGOUT')).toHaveLength(1);
    expect(result.getOperationsByType('FILE_UPLOAD')).toHaveLength(1);
    expect(result.getOperationsByType('FILE_DELETE')).toHaveLength(1);

    expect(firestoreOps).toHaveLength(6);
    expect(authOps).toHaveLength(4);
    expect(storageOps).toHaveLength(3);
    expect(result.totalOperations).toBeGreaterThanOrEqual(17);
  });

  it('ejecuta todas las reglas registradas por defecto', async () => {
    const analyzer = new SemanticAnalyzer();
    const rules = analyzer.getRegistry().getRules();

    expect(rules.map((rule) => rule.id)).toEqual([
      'firebase-import',
      'firebase-firestore',
      'firebase-auth',
      'firebase-storage',
    ]);
  });
});
