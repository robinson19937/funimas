import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { TransformationRecordData } from './TransformationRecord.js';
import { TransformationRecord } from './TransformationRecord.js';
import { HistoryReader } from './HistoryWriter.js';
import { HistoryWriter } from './HistoryWriter.js';

export class TransformationHistory {
  private readonly workspacePath: string;
  private readonly writer: HistoryWriter;
  private readonly reader: HistoryReader;
  private readonly records: TransformationRecord[] = [];
  private readonly recordSequences = new Map<string, number>();
  private nextSequence = 1;
  private initialized = false;

  constructor(
    workspacePath: string,
    writer: HistoryWriter = new HistoryWriter(),
    reader: HistoryReader = new HistoryReader(),
  ) {
    this.workspacePath = workspacePath;
    this.writer = writer;
    this.reader = reader;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const historyDir = join(this.workspacePath, '.funimas', 'history');

    try {
      const entries = await readdir(historyDir);
      const jsonFiles = entries.filter((entry) => entry.endsWith('.json')).sort();

      for (const fileName of jsonFiles) {
        const sequence = Number.parseInt(fileName.replace('.json', ''), 10);
        const content = await readFile(join(historyDir, fileName), 'utf8');
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const record = TransformationRecord.fromJSON(parsed);

        this.records.push(record);
        this.recordSequences.set(record.id, sequence);
      }
    } catch {
      // Historial vacío
    }

    this.nextSequence = await this.reader.getNextSequence(this.workspacePath);
    this.initialized = true;
  }

  async record(data: Omit<TransformationRecordData, 'id' | 'timestamp'>): Promise<TransformationRecord> {
    await this.initialize();

    const record = new TransformationRecord({
      ...data,
      timestamp: new Date(),
    });

    await this.writer.write(this.workspacePath, this.nextSequence, record);
    this.recordSequences.set(record.id, this.nextSequence);
    this.nextSequence += 1;
    this.records.push(record);

    return record;
  }

  getById(id: string): TransformationRecord | undefined {
    return this.records.find((record) => record.id === id);
  }

  async updateRecord(
    id: string,
    updates: Partial<TransformationRecordData>,
  ): Promise<TransformationRecord | null> {
    await this.initialize();

    const index = this.records.findIndex((record) => record.id === id);

    if (index === -1) {
      return null;
    }

    const current = this.records[index]!;
    const updated = current.withUpdates(updates);
    const sequence = this.recordSequences.get(id);

    if (sequence !== undefined) {
      await this.writer.write(this.workspacePath, sequence, updated);
    }

    this.records[index] = updated;

    return updated;
  }

  getRecords(): TransformationRecord[] {
    return [...this.records];
  }

  getRecordCount(): number {
    return this.records.length;
  }
}
