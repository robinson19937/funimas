import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_SUFFIX,
  getWorkspaceProjectPath,
} from '../src/workspace/WorkspaceUtils.js';

describe('WorkspaceUtils', () => {
  it('construye la ruta del workspace junto al proyecto original', () => {
    expect(getWorkspaceProjectPath(join('/tmp', 'CRM'))).toBe(join('/tmp', 'CRM_funimas'));
  });

  it('expone el sufijo del workspace', () => {
    expect(WORKSPACE_SUFFIX).toBe('_funimas');
  });
});
