import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CliApp } from '../src/cli/cli.js';
import { ProjectStatusAnalyzer } from '../src/status/index.js';

describe('ProjectStatusAnalyzer', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
        await rm(`${dir}_funimas`, { recursive: true, force: true });
      }),
    );
  });

  async function createProject(files: Record<string, string>): Promise<string> {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-status-'));
    tempDirs.push(projectDir);

    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = join(projectDir, relativePath);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, content, 'utf8');
    }

    return projectDir;
  }

  it('reporta APIs soportadas y bloqueos por runTransaction', async () => {
    const projectDir = await createProject({
      'src/data.ts': `import { addDoc, collection, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';

export async function save() {
  await addDoc(collection(db, 'users'), { name: 'Alice' });
  await runTransaction(db, async (tx) => tx.get(collection(db, 'users')));
}
`,
    });

    const analyzer = new ProjectStatusAnalyzer();
    const report = await analyzer.analyze(projectDir);

    expect(report.firestoreSupported.addDoc).toBe(1);
    expect(report.firestoreUnsupported.runTransaction).toBe(1);
    expect(report.productionReady).toBe(false);
    expect(report.blockers[0]).toContain('no soportadas');
  });

  it('marca runTransaction convertible como no bloqueante en status', async () => {
    const projectDir = await createProject({
      'src/data.ts': `import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';

export async function transferCredits(fromId, toId, amount) {
  await runTransaction(db, async (tx) => {
    tx.update(doc(db, 'accounts', fromId), { balance: 100 - amount });
    tx.update(doc(db, 'accounts', toId), { balance: 100 + amount });
  });
}
`,
    });

    const analyzer = new ProjectStatusAnalyzer();
    const report = await analyzer.analyze(projectDir);

    expect(report.unsupportedFindings.some((finding) => finding.callee === 'runTransaction')).toBe(
      true,
    );
    expect(
      report.unsupportedFindings.find((finding) => finding.callee === 'runTransaction')
        ?.convertibleByDomainMutation,
    ).toBe(true);
    expect(report.firestoreUnsupported.runTransaction ?? 0).toBe(0);
    expect(report.productionReady).toBe(true);
  });

  it('marca proyecto como listo cuando solo usa APIs soportadas', async () => {
    const projectDir = await createProject({
      'src/data.ts': `import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase.js';

export async function load(id: string) {
  return getDoc(doc(db, 'users', id));
}
`,
    });

    const analyzer = new ProjectStatusAnalyzer();
    const report = await analyzer.analyze(projectDir);

    expect(report.firestoreSupported.getDoc).toBe(1);
    expect(report.unsupportedFindings).toHaveLength(0);
    expect(report.productionReady).toBe(true);
  });
});

describe('status CLI', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
      }),
    );
  });

  it('ejecuta funimas status sobre un proyecto', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-status-cli-'));
    tempDirs.push(projectDir);
    await mkdir(join(projectDir, 'src'), { recursive: true });
    await writeFile(
      join(projectDir, 'src', 'app.ts'),
      `import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase.js';
export const load = (id: string) => getDoc(doc(db, 'users', id));
`,
      'utf8',
    );

    const app = new CliApp({
      argv: ['node', 'funimas', 'status', projectDir],
    });

    const exitCode = await app.run();

    expect(exitCode).toBe(0);
  });
});
