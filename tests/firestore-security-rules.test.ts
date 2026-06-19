import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const describeWithFirestore =
  process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS
    ? describe
    : describe.skip;

describeWithFirestore('firestore.rules multiempresa', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: `demo-funimas-${Date.now()}`,
      firestore: {
        rules: await readFile(join(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  function dbFor(uid: string) {
    return testEnv.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
  }

  async function createUserAndCompany(uid = 'owner', companyId = 'acme') {
    const db = dbFor(uid);

    await assertSucceeds(
      setDoc(doc(db, 'users', uid), {
        uid,
        email: `${uid}@example.com`,
        companyId,
        createdAt: '2026-06-19T00:00:00.000Z',
        updatedAt: '2026-06-19T00:00:00.000Z',
      }),
    );

    await assertSucceeds(
      setDoc(doc(db, 'companies', companyId), {
        id: companyId,
        name: 'Acme',
        ownerId: uid,
        createdAt: '2026-06-19T00:00:00.000Z',
        updatedAt: '2026-06-19T00:00:00.000Z',
      }),
    );

    return db;
  }

  it('permite el registro completo de usuario, empresa y settings/main', async () => {
    const db = await createUserAndCompany('owner', 'acme');

    await assertSucceeds(
      setDoc(doc(db, 'companies', 'acme', 'settings', 'main'), {
        companyId: 'acme',
        currency: 'USD',
        updatedAt: '2026-06-19T00:00:00.000Z',
      }),
    );
  });

  it('rechaza una empresa repetida o creada con owner ajeno', async () => {
    await createUserAndCompany('owner', 'acme');
    const attackerDb = dbFor('attacker');

    await assertFails(
      setDoc(doc(attackerDb, 'companies', 'acme'), {
        id: 'acme',
        name: 'Acme secuestrada',
        ownerId: 'attacker',
        createdAt: '2026-06-19T00:00:00.000Z',
        updatedAt: '2026-06-19T00:00:00.000Z',
      }),
    );

    await assertFails(
      setDoc(doc(attackerDb, 'companies', 'otra'), {
        id: 'otra',
        name: 'Otra',
        ownerId: 'owner',
        createdAt: '2026-06-19T00:00:00.000Z',
        updatedAt: '2026-06-19T00:00:00.000Z',
      }),
    );
  });

  it('rechaza settings/main cuando quien escribe no es el owner de la empresa', async () => {
    await createUserAndCompany('owner', 'acme');
    const memberDb = dbFor('member');

    await assertSucceeds(
      setDoc(doc(memberDb, 'users', 'member'), {
        uid: 'member',
        email: 'member@example.com',
        companyId: 'acme',
        createdAt: '2026-06-19T00:00:00.000Z',
        updatedAt: '2026-06-19T00:00:00.000Z',
      }),
    );

    await assertFails(
      setDoc(doc(memberDb, 'companies', 'acme', 'settings', 'main'), {
        companyId: 'acme',
        currency: 'USD',
        updatedAt: '2026-06-19T00:00:00.000Z',
      }),
    );
  });

  it('exige userId correcto al crear cotizaciones, recibos, notas y varios', async () => {
    const db = await createUserAndCompany('owner', 'acme');

    for (const collection of ['cotizaciones', 'recibos', 'notas', 'varios']) {
      await assertSucceeds(
        setDoc(doc(db, collection, `${collection}-ok`), {
          companyId: 'acme',
          userId: 'owner',
          title: collection,
        }),
      );

      await assertFails(
        setDoc(doc(db, collection, `${collection}-bad`), {
          companyId: 'acme',
          userId: 'other-user',
          title: collection,
        }),
      );
    }
  });

  it('rechaza updates que cambian userId o companyId', async () => {
    const db = await createUserAndCompany('owner', 'acme');

    await assertSucceeds(
      setDoc(doc(db, 'cotizaciones', 'quote-1'), {
        companyId: 'acme',
        userId: 'owner',
        title: 'Quote',
      }),
    );

    await assertSucceeds(
      updateDoc(doc(db, 'cotizaciones', 'quote-1'), {
        title: 'Quote updated',
      }),
    );

    await assertFails(
      updateDoc(doc(db, 'cotizaciones', 'quote-1'), {
        userId: 'attacker',
      }),
    );

    await assertFails(
      updateDoc(doc(db, 'cotizaciones', 'quote-1'), {
        companyId: 'other-company',
      }),
    );
  });

  it('solo permite crear users/{uid} al usuario autenticado correspondiente', async () => {
    const db = dbFor('alice');

    await assertSucceeds(
      setDoc(doc(db, 'users', 'alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        companyId: 'acme',
        createdAt: '2026-06-19T00:00:00.000Z',
        updatedAt: '2026-06-19T00:00:00.000Z',
      }),
    );

    await expect(
      assertFails(
        setDoc(doc(db, 'users', 'bob'), {
          uid: 'bob',
          email: 'bob@example.com',
          companyId: 'acme',
          createdAt: '2026-06-19T00:00:00.000Z',
          updatedAt: '2026-06-19T00:00:00.000Z',
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
