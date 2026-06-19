import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, afterEach } from 'vitest';

import { HtmlScriptExtractor } from '../src/parser/HtmlScriptExtractor.js';
import { TsMorphProjectLoader } from '../src/parser/TsMorphProjectLoader.js';
import { GraphBuilder } from '../src/graph/GraphBuilder.js';
import { AstParser } from '../src/parser/AstParser.js';
import { ProjectScanner } from '../src/scanner/ProjectScanner.js';
import { SemanticAnalyzer } from '../src/semantic/SemanticAnalyzer.js';
import { CodeRewriter } from '../src/rewriter/CodeRewriter.js';
import { RewriteContext } from '../src/rewriter/RewriteContext.js';

describe('HtmlScriptExtractor', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('extrae scripts inline y los fusiona de vuelta en el HTML', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-html-'));
    tempDirs.push(projectDir);

    await writeFile(
      join(projectDir, 'page.html'),
      `<!DOCTYPE html>
<html>
<body>
<script type="module">
import { getDoc, doc } from './firebase.js';
await getDoc(doc(db, 'users', '1'));
</script>
</body>
</html>`,
      'utf8',
    );

    const extractor = new HtmlScriptExtractor();
    const manifest = await extractor.extract(projectDir);

    expect(manifest.entries).toHaveLength(1);

    const extracted = await readFile(join(projectDir, manifest.entries[0]!.extractedPath), 'utf8');
    expect(extracted).toContain("getDoc(doc(db, 'users', '1'))");
    expect(manifest.entries[0]!.extractedPath).toBe('page.funimas-inline.0.js');

    await writeFile(
      join(projectDir, manifest.entries[0]!.extractedPath),
      extracted.replace(
        "getDoc(doc(db, 'users', '1'))",
        "Funimas.database.get('users', '1')",
      ),
      'utf8',
    );

    const merged = await extractor.merge(projectDir);
    const html = await readFile(join(projectDir, 'page.html'), 'utf8');

    expect(merged).toBe(1);
    expect(html).toContain("Funimas.database.get('users', '1')");
    expect(html).not.toContain("getDoc(doc(db, 'users', '1'))");
  });

  it('mantiene imports relativos al extraer scripts de HTML anidado', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-html-nested-'));
    tempDirs.push(projectDir);

    await mkdir(join(projectDir, 'js'), { recursive: true });
    await writeFile(join(projectDir, 'js', 'firebase.js'), "export const db = {};\n", 'utf8');
    await mkdir(join(projectDir, 'cotizaciones'), { recursive: true });
    await writeFile(
      join(projectDir, 'cotizaciones', 'nueva.html'),
      `<script type="module">
import { db } from '../js/firebase.js';
console.log(db);
</script>`,
      'utf8',
    );

    const extractor = new HtmlScriptExtractor();
    const manifest = await extractor.extract(projectDir);

    expect(manifest.entries[0]!.extractedPath).toBe('cotizaciones/nueva.funimas-inline.0.js');

    const loader = new TsMorphProjectLoader();
    const project = await loader.load(projectDir);
    const inlineFile = project.getSourceFileOrThrow(
      join(projectDir, 'cotizaciones/nueva.funimas-inline.0.js'),
    );
    const importDecl = inlineFile.getImportDeclarations()[0];

    expect(importDecl?.getModuleSpecifierSourceFile()?.getFilePath()).toBe(
      join(projectDir, 'js/firebase.js'),
    );
  });
});

async function rewriteContent(source: string): Promise<string> {
  const projectDir = await mkdtemp(join(tmpdir(), 'funimas-rewrite-gap-'));

  try {
    await writeFile(join(projectDir, 'sample.js'), source, 'utf8');

    const parser = new AstParser();
    const scanner = new ProjectScanner();
    const graphBuilder = new GraphBuilder();
    const semanticAnalyzer = new SemanticAnalyzer();
    const rewriter = new CodeRewriter();

    const parseResult = await parser.parse(projectDir);
    const scanResult = await scanner.scan(parseResult.project);
    const graphResult = graphBuilder.build(scanResult);
    const semanticResult = await semanticAnalyzer.analyze(graphResult);

    await rewriter.rewrite(
      new RewriteContext({
        projectPath: projectDir,
        workspacePath: projectDir,
        semanticResult,
      }),
    );

    return readFile(join(projectDir, 'sample.js'), 'utf8');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
}

describe('Firestore rewrite gaps', () => {
  it('reescribe getDocs(query(...)) a listWhere', async () => {
    const content = await rewriteContent(`import { collection, db, getDocs, query, where } from './firebase.js';

export async function load(userId) {
  const q = query(collection(db, 'cotizaciones'), where('userId', '==', userId));
  return getDocs(q);
}
`);

    expect(content).toContain("Funimas.database.listWhere('cotizaciones', 'userId', '==', userId)");
    expect(content).not.toContain('getDocs(q)');
  });

  it('reescribe deleteDoc(snap.ref) cuando snap viene de Funimas.database.get', async () => {
    const content = await rewriteContent(`import { deleteDoc } from './firebase.js';
import { Funimas } from '@funimas/sdk';

export async function eliminar(id) {
  const snap = await Funimas.database.get('cotizaciones', id);
  await deleteDoc(snap.ref);
}
`);

    expect(content).toContain("Funimas.database.delete('cotizaciones', id)");
    expect(content).not.toContain('deleteDoc(snap.ref)');
  });

  it('reescribe doc con subcolección usando getAtPath', async () => {
    const content = await rewriteContent(`import { doc, db, getDoc } from './firebase.js';

export async function loadSettings(companyId) {
  return getDoc(doc(db, 'companies', companyId, 'settings', 'main'));
}
`);

    expect(content).toContain(
      "Funimas.database.getAtPath('companies', companyId, 'settings', 'main')",
    );
    expect(content).not.toContain('getDoc(doc(');
  });
});
