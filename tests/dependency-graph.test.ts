import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GraphAnalyzer } from '../src/graph/GraphAnalyzer.js';
import { GraphBuilder } from '../src/graph/GraphBuilder.js';
import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sampleProjectPath = join(fixturesDir, 'sample-project');

async function buildSampleGraph() {
  const parser = new AstParser();
  const scanner = new ProjectScanner();
  const builder = new GraphBuilder({
    now: () => new Date(2026, 5, 18, 14, 35, 22),
  });

  const parseResult = await parser.parse(sampleProjectPath);
  const scanResult = await scanner.scan(parseResult.project);

  return builder.build(scanResult);
}

describe('GraphBuilder', () => {
  it('construye nodos para cada archivo del ScanResult', async () => {
    const graphResult = await buildSampleGraph();

    expect(graphResult.totalNodes).toBe(6);
    expect(graphResult.graph.getNodes()).toHaveLength(6);
    expect(graphResult.duration).toBe(0);
  });

  it('construye relaciones de importación entre archivos internos', async () => {
    const graphResult = await buildSampleGraph();
    const analyzer = new GraphAnalyzer(graphResult.graph);

    expect(graphResult.totalImports).toBe(2);
    expect(graphResult.totalEdges).toBeGreaterThanOrEqual(2);

    const appFilePath = normalize(join(sampleProjectPath, 'src/app.ts'));
    const indexFilePath = normalize(join(sampleProjectPath, 'src/index.js'));
    const userServicePath = normalize(join(sampleProjectPath, 'src/services/user-service.ts'));

    const appDependencies = analyzer.findDependencies(appFilePath);
    const indexDependencies = analyzer.findDependencies(indexFilePath);
    const userServiceDependents = analyzer.findDependents(userServicePath);
    const appDependents = analyzer.findDependents(appFilePath);

    expect(appDependencies.map((node) => node.path)).toContain(userServicePath);
    expect(indexDependencies.map((node) => node.path)).toContain(appFilePath);
    expect(userServiceDependents.map((node) => node.path)).toContain(appFilePath);
    expect(appDependents.map((node) => node.path)).toContain(indexFilePath);
  });

  it('calcula componentes conectados del grafo', async () => {
    const graphResult = await buildSampleGraph();

    expect(graphResult.totalConnectedComponents).toBeGreaterThanOrEqual(1);
  });
});

describe('GraphAnalyzer', () => {
  it('identifica hojas, puntos de entrada y archivos huérfanos', async () => {
    const graphResult = await buildSampleGraph();
    const analyzer = new GraphAnalyzer(graphResult.graph);

    const leafNodes = analyzer.findLeafNodes().map((node) => node.name);
    const entryPoints = analyzer.findEntryPoints().map((node) => node.name);
    const orphanFiles = analyzer.findOrphanFiles().map((node) => node.name);

    expect(leafNodes).toContain('user-service.ts');
    expect(entryPoints).toContain('index.js');
    expect(orphanFiles.length).toBeGreaterThan(0);
  });

  it('devuelve listas vacías para archivos inexistentes', async () => {
    const graphResult = await buildSampleGraph();
    const analyzer = new GraphAnalyzer(graphResult.graph);

    expect(analyzer.findDependencies('/ruta/inexistente.ts')).toEqual([]);
    expect(analyzer.findDependents('/ruta/inexistente.ts')).toEqual([]);
    expect(analyzer.findCircularDependencies()).toEqual([]);
  });
});
