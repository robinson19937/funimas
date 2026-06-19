import { afterEach, describe, expect, it } from 'vitest';

import {
  REGRESSION_FIXTURES,
  assertRegressionExpectations,
  cleanupRegressionRun,
  runProtectFixture,
  type RegressionRunResult,
} from './helpers/run-protect-fixture.js';

describe('protect regression fixtures', () => {
  const activeRuns: RegressionRunResult[] = [];

  afterEach(async () => {
    await Promise.all(activeRuns.splice(0).map((run) => cleanupRegressionRun(run)));
  });

  it.each(REGRESSION_FIXTURES)('$id — $description', async (fixture) => {
    const run = await runProtectFixture(fixture);
    activeRuns.push(run);

    await expect(assertRegressionExpectations(run, fixture.expectations)).resolves.toBeUndefined();
  });
});
