import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { Project, SyntaxKind } from 'ts-morph';

import { CompositeWriteDetector } from '../src/domain/CompositeWriteDetector.js';
import { SemanticResult } from '../src/semantic/SemanticResult.js';
import { createEmptyActionsByType } from '../src/planner/PlannerResult.js';
import {
  buildDataTemplate,
  buildIncrementSentinel,
  isIncrementAmountSpec,
} from '../src/domain/write-template-builder.js';

function createSemanticResult(): SemanticResult {
  return new SemanticResult({
    operations: [],
    totalOperations: 0,
    operationsByType: createEmptyActionsByType(),
    startedAt: new Date(),
    finishedAt: new Date(),
  });
}

function parseObjectLiteral(source: string): import('ts-morph').ObjectLiteralExpression {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile('temp.ts', `const payload = ${source};`);
  const declaration = file.getVariableDeclarationOrThrow('payload');
  const initializer = declaration.getInitializerOrThrow();

  return initializer.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
}

describe('write-template-builder', () => {
  it('convierte snap.data().field - param en increment negativo', () => {
    const template = buildDataTemplate(
      parseObjectLiteral('{ balance: fromSnap.data().balance - amount }'),
    );

    expect(template?.balance).toEqual(
      buildIncrementSentinel({ param: 'amount', sign: -1 }),
    );
  });

  it('convierte snap.data().field + param en increment positivo', () => {
    const template = buildDataTemplate(
      parseObjectLiteral('{ balance: toSnap.data().balance + amount }'),
    );

    expect(template?.balance).toEqual(
      buildIncrementSentinel({ param: 'amount', sign: 1 }),
    );
  });

  it('convierte snap.data().field - literal en increment numérico', () => {
    const template = buildDataTemplate(
      parseObjectLiteral('{ balance: fromSnap.data().balance - 5 }'),
    );

    expect(template?.balance).toEqual(buildIncrementSentinel(-5));
  });

  it('detecta IncrementAmountSpec para collectParamNames', () => {
    const spec = { param: 'amount', sign: -1 as const };
    expect(isIncrementAmountSpec(spec)).toBe(true);
  });

  it('convierte propiedades abreviadas en parámetros de plantilla', () => {
    const template = buildDataTemplate(
      parseObjectLiteral('{ companyId, email, createdAt: timestamp }'),
    );

    expect(template).toEqual({
      companyId: '$companyId',
      email: '$email',
      createdAt: '$timestamp',
    });
  });
});

describe('CompositeWriteDetector', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function createProject(source: string): Promise<string> {
    const projectDir = await mkdtemp(join(tmpdir(), 'funimas-domain-'));
    tempDirs.push(projectDir);
    await writeFile(join(projectDir, 'app.js'), source, 'utf8');
    await writeFile(
      join(projectDir, 'firebase.js'),
      "export const db = {};\n",
      'utf8',
    );
    return projectDir;
  }

  it('detecta writeBatch con múltiples escrituras', async () => {
    const projectDir = await createProject(`import { doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase.js';

export async function syncUserProfile(userId, profile) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', userId), profile);
  batch.set(doc(db, 'profiles', userId), { displayName: profile.name });
  await batch.commit();
}
`);

    const detector = new CompositeWriteDetector();
    const mutations = await detector.detect(projectDir, createSemanticResult());

    expect(mutations).toHaveLength(1);
    expect(mutations[0]?.id).toBe('syncUserProfile');
    expect(mutations[0]?.writes).toHaveLength(2);
    expect(mutations[0]?.operationKeys.some((key) => key.includes(':'))).toBe(true);
  });

  it('detecta runTransaction con parámetro tx y lecturas dependientes', async () => {
    const projectDir = await createProject(`import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';

export async function transferCredits(fromId, toId, amount) {
  await runTransaction(db, async (tx) => {
    const fromSnap = await tx.get(doc(db, 'accounts', fromId));
    const toSnap = await tx.get(doc(db, 'accounts', toId));
    tx.update(doc(db, 'accounts', fromId), { balance: fromSnap.data().balance - amount });
    tx.update(doc(db, 'accounts', toId), { balance: toSnap.data().balance + amount });
  });
}
`);

    const detector = new CompositeWriteDetector();
    const mutations = await detector.detect(projectDir, createSemanticResult());

    expect(mutations).toHaveLength(1);
    expect(mutations[0]?.writes[0]?.dataTemplate?.balance).toEqual(
      buildIncrementSentinel({ param: 'amount', sign: -1 }),
    );
    expect(mutations[0]?.writes[1]?.dataTemplate?.balance).toEqual(
      buildIncrementSentinel({ param: 'amount', sign: 1 }),
    );
  });

  it('detecta setDoc múltiples en callback de addEventListener', async () => {
    const projectDir = await createProject(`import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';

document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const uid = 'user-1';
  const companyId = 'acme-user-1';
  const email = 'demo@example.com';
  const businessName = 'Mi empresa';
  const timestamp = serverTimestamp();

  await setDoc(doc(db, 'users', uid), { companyId, email, createdAt: timestamp });
  await setDoc(doc(db, 'companies', companyId), { name: businessName, ownerUid: uid }, { merge: true });
  await setDoc(doc(db, 'companies', companyId, 'settings', 'main'), { businessName, companyId, email }, { merge: true });
});
`);

    const detector = new CompositeWriteDetector();
    const mutations = await detector.detect(projectDir, createSemanticResult());

    expect(mutations).toHaveLength(1);
    expect(mutations[0]?.id).toBe('registerCompany');
    expect(mutations[0]?.replacementScope).toBe('statement-range');
    expect(mutations[0]?.writes).toHaveLength(3);
    expect(mutations[0]?.invokeParams).toEqual(
      expect.arrayContaining(['uid', 'email', 'companyId', 'businessName', 'timestamp']),
    );
    expect(mutations[0]?.writes[0]?.dataTemplate).toEqual({
      companyId: '$companyId',
      email: '$email',
      createdAt: '$timestamp',
    });
    expect(mutations[0]?.writes[2]?.dataTemplate).toMatchObject({
      businessName: '$businessName',
      companyId: '$companyId',
      email: '$email',
    });
  });
});
