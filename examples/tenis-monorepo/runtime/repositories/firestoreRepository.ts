import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { applyClubAction, createInitialClubDocument } from '../../shared/ladderMutations.js';
import type { ClubAction, ClubDocument, ClubSettings } from '../../shared/types/club.js';

const CLUBS_COLLECTION = 'clubs';
const FIRESTORE_SENTINEL_KEY = '__funimasFirestoreSentinel';

function getDb() {
  return getFirestore();
}

function clubRef(clubId: string) {
  return getDb().collection(CLUBS_COLLECTION).doc(clubId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function decodeFirestoreJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => decodeFirestoreJson(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  if (value[FIRESTORE_SENTINEL_KEY] === 'serverTimestamp') {
    return FieldValue.serverTimestamp();
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, decodeFirestoreJson(entry)]),
  );
}

function decodeWriteData(data: Record<string, unknown>): Record<string, unknown> {
  return decodeFirestoreJson(data) as Record<string, unknown>;
}

export class DocumentAlreadyExistsError extends Error {
  readonly status = 409;
  readonly code = 'ALREADY_EXISTS';

  constructor(path: string) {
    super(`No se puede crear el documento "${path}" porque ya existe.`);
    this.name = 'DocumentAlreadyExistsError';
  }
}

export class DocumentNotFoundForUpdateError extends Error {
  readonly status = 404;
  readonly code = 'NOT_FOUND';

  constructor(path: string) {
    super(
      `No se puede actualizar un documento inexistente ("${path}"). Usa set/upsert para creación inicial.`,
    );
    this.name = 'DocumentNotFoundForUpdateError';
  }
}

export class FirestoreRepository {
  async getClub(clubId: string): Promise<ClubDocument | null> {
    const snapshot = await clubRef(clubId).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as unknown as ClubDocument;
  }

  async createClub(clubId: string, settings: ClubSettings, creatorUid: string): Promise<ClubDocument> {
    const existing = await this.getClub(clubId);
    if (existing) {
      throw new Error('Ya existe un club con ese identificador.');
    }

    const document = createInitialClubDocument(settings, creatorUid);
    await clubRef(clubId).set(document);
    return document;
  }

  async mutateClub(clubId: string, uid: string, action: ClubAction): Promise<ClubDocument> {
    const db = getDb();
    const ref = clubRef(clubId);

    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);

      if (!snapshot.exists) {
        throw new Error('Club no encontrado.');
      }

      const current = snapshot.data() as unknown as ClubDocument;
      const updated = applyClubAction(current, uid, action);

      transaction.set(ref, updated);
      return updated;
    });
  }

  async insert(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const ref = getDb().collection(collection).doc();
    await ref.set(decodeWriteData(data));
    return { id: ref.id };
  }

  async getDocument(collection: string, id: string): Promise<Record<string, unknown> | null> {
    return this.getDocumentByPath([collection, id]);
  }

  async getDocumentByPath(pathSegments: string[]): Promise<Record<string, unknown> | null> {
    const snapshot = await getDb().doc(this.toDocumentPath(pathSegments)).get();

    if (!snapshot.exists) {
      return null;
    }

    return { id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) };
  }

  async listDocuments(collection: string): Promise<Record<string, unknown>[]> {
    const snapshot = await getDb().collection(collection).get();

    return snapshot.docs.map((document: { id: string; data(): Record<string, unknown> | undefined }) => ({
      id: document.id,
      ...(document.data() as Record<string, unknown>),
    }));
  }

  async listDocumentsWhere(
    collection: string,
    filters: Array<{ field: string; operator: string; value: unknown }>,
  ): Promise<Record<string, unknown>[]> {
    let queryRef: any = getDb().collection(collection);

    for (const filter of filters) {
      queryRef = queryRef.where(filter.field, filter.operator, filter.value);
    }

    const snapshot = await queryRef.get();

    return snapshot.docs.map((document: { id: string; data(): Record<string, unknown> | undefined }) => ({
      id: document.id,
      ...(document.data() as Record<string, unknown>),
    }));
  }

  async setDocument(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.setDocumentByPath([collection, id], data);
  }

  async setDocumentByPath(pathSegments: string[], data: Record<string, unknown>): Promise<void> {
    await getDb().doc(this.toDocumentPath(pathSegments)).set(decodeWriteData(data));
  }

  async createDocument(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.createDocumentByPath([collection, id], data);
  }

  async createDocumentByPath(pathSegments: string[], data: Record<string, unknown>): Promise<void> {
    const path = this.toDocumentPath(pathSegments);
    const ref = getDb().doc(path);
    const snapshot = await ref.get();

    if (snapshot.exists) {
      throw new DocumentAlreadyExistsError(path);
    }

    await ref.set(decodeWriteData(data));
  }

  async upsertDocument(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.upsertDocumentByPath([collection, id], data);
  }

  async upsertDocumentByPath(pathSegments: string[], data: Record<string, unknown>): Promise<void> {
    await getDb()
      .doc(this.toDocumentPath(pathSegments))
      .set(decodeWriteData(data), { merge: true });
  }

  async updateDocument(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.updateDocumentByPath([collection, id], data);
  }

  async updateDocumentByPath(pathSegments: string[], data: Record<string, unknown>): Promise<void> {
    const path = this.toDocumentPath(pathSegments);
    const ref = getDb().doc(path);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      throw new DocumentNotFoundForUpdateError(path);
    }

    await ref.update(decodeWriteData(data));
  }

  async deleteDocument(collection: string, id: string): Promise<void> {
    await this.deleteDocumentByPath([collection, id]);
  }

  async deleteDocumentByPath(pathSegments: string[]): Promise<void> {
    await getDb().doc(this.toDocumentPath(pathSegments)).delete();
  }

  private toDocumentPath(pathSegments: string[]): string {
    return pathSegments.map((segment) => String(segment)).join('/');
  }
}
