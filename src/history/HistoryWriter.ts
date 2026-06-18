import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { TransformationRecord } from './TransformationRecord.js';

export class HistoryWriter {
  async write(workspacePath: string, sequence: number, record: TransformationRecord): Promise<string> {
    const historyDir = join(workspacePath, '.funimas', 'history');

    await mkdir(historyDir, { recursive: true });

    const fileName = `${String(sequence).padStart(6, '0')}.json`;
    const filePath = join(historyDir, fileName);

    await writeFile(filePath, `${JSON.stringify(record.toJSON(), null, 2)}\n`, 'utf8');

    return filePath;
  }
}

export class HistoryReader {
  async readAll(workspacePath: string): Promise<TransformationRecord[]> {
    const historyDir = join(workspacePath, '.funimas', 'history');

    try {
      const entries = await readdir(historyDir);
      const jsonFiles = entries.filter((entry) => entry.endsWith('.json')).sort();
      const records: TransformationRecord[] = [];

      for (const fileName of jsonFiles) {
        const content = await readFile(join(historyDir, fileName), 'utf8');
        const parsed = JSON.parse(content) as Record<string, unknown>;

        records.push(TransformationRecord.fromJSON(parsed));
      }

      return records;
    } catch {
      return [];
    }
  }

  async getNextSequence(workspacePath: string): Promise<number> {
    const historyDir = join(workspacePath, '.funimas', 'history');

    try {
      const entries = await readdir(historyDir);
      const sequences = entries
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) => Number.parseInt(entry.replace('.json', ''), 10))
        .filter((value) => !Number.isNaN(value));

      if (sequences.length === 0) {
        return 1;
      }

      return Math.max(...sequences) + 1;
    } catch {
      return 1;
    }
  }
}
