import type { TransformationRecordData } from './TransformationRecord.js';
import { TransformationRecord } from './TransformationRecord.js';
import { HistoryReader } from './HistoryWriter.js';
import { HistoryWriter } from './HistoryWriter.js';

export class TransformationHistory {
  private readonly workspacePath: string;
  private readonly writer: HistoryWriter;
  private readonly reader: HistoryReader;
  private readonly records: TransformationRecord[] = [];
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

    this.records.push(...(await this.reader.readAll(this.workspacePath)));
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
    this.nextSequence += 1;
    this.records.push(record);

    return record;
  }

  getRecords(): TransformationRecord[] {
    return [...this.records];
  }

  getRecordCount(): number {
    return this.records.length;
  }
}
