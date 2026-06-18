import { describe, expect, it } from 'vitest';

import {
  EXCLUDED_ENTRIES,
  formatBackupTimestamp,
  getRelativeBackupPath,
  isExcludedEntry,
} from '../src/backup/BackupUtils.js';

describe('BackupUtils', () => {
  it('formatea la marca de tiempo del backup', () => {
    const timestamp = formatBackupTimestamp(new Date(2026, 5, 18, 14, 35, 22));

    expect(timestamp).toBe('2026-06-18_14-35-22');
  });

  it('construye la ruta relativa del backup', () => {
    expect(getRelativeBackupPath('2026-06-18_14-35-22')).toBe(
      '.funimas/backups/2026-06-18_14-35-22',
    );
  });

  it('identifica entradas excluidas del backup', () => {
    for (const entry of EXCLUDED_ENTRIES) {
      expect(isExcludedEntry(entry)).toBe(true);
    }

    expect(isExcludedEntry('src')).toBe(false);
  });
});
