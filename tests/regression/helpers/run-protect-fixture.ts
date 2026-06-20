import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProtectPipeline } from '../../../src/pipeline/ProtectPipeline.js';
import type { ProtectPipelineResult } from '../../../src/pipeline/ProtectPipelineResult.js';
import { NullOutputWriter } from '../../../src/utils/output.js';

const regressionRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const examplesRoot = join(regressionRoot, '..', '..', 'examples');

export interface ContentAssertion {
  file: string;
  includes: string[];
  excludes?: string[];
}

export interface RegressionFixtureExpectations {
  success: boolean;
  validationValid: boolean;
  verificationReady: boolean;
  operationsUntransformed?: number;
  filesMustExist?: string[];
  contentAssertions?: ContentAssertion[];
}

export interface RegressionFixtureDefinition {
  id: string;
  description: string;
  sourcePath: string;
  expectations: RegressionFixtureExpectations;
}

export interface RegressionRunResult {
  fixtureId: string;
  projectDir: string;
  result: ProtectPipelineResult;
  summary: Record<string, unknown>;
}

export const REGRESSION_FIXTURES: RegressionFixtureDefinition[] = [
  {
    id: 'react-firebase-crud',
    description: 'Ejemplo React CRUD incluido en examples/',
    sourcePath: join(examplesRoot, 'react-firebase-crud'),
    expectations: {
      success: true,
      validationValid: true,
      verificationReady: true,
      operationsUntransformed: 0,
      filesMustExist: [
        'runtime/handler.ts',
        'sdk/index.ts',
        'netlify/functions/database_insert.ts',
        '.funimas/reports/summary.json',
      ],
      contentAssertions: [
        {
          file: 'src/App.tsx',
          includes: ["Funimas.domain.execute('createDemoUsers', {}"],
          excludes: ['addDoc(collection(db'],
        },
      ],
    },
  },
  {
    id: 'multi-company-onboarding',
    description: 'Patrones productivos: alta multiempresa, settings merge y listWhere',
    sourcePath: join(regressionRoot, 'fixtures', 'multi-company-onboarding'),
    expectations: {
      success: true,
      validationValid: true,
      verificationReady: true,
      operationsUntransformed: 0,
      filesMustExist: ['runtime/handler.ts', 'sdk/index.ts', 'netlify/functions/funimas.ts'],
      contentAssertions: [
        {
          file: 'js/auth.js',
          includes: ["Funimas.domain.execute('registerCompany'"],
          excludes: ['setDoc(companyRef', 'merge: true'],
        },
        {
          file: 'js/cotizaciones.js',
          includes: ["Funimas.database.listWhere('cotizaciones'"],
          excludes: ['getDocs(q)'],
        },
      ],
    },
  },
  {
    id: 'pwa-html-queries',
    description: 'PWA con scripts inline en HTML y consultas con where',
    sourcePath: join(regressionRoot, 'fixtures', 'pwa-html-queries'),
    expectations: {
      success: true,
      validationValid: true,
      verificationReady: true,
      operationsUntransformed: 0,
      contentAssertions: [
        {
          file: 'index.html',
          includes: ["Funimas.database.listWhere('recibos'"],
          excludes: ['getDocs(q)'],
        },
      ],
    },
  },
  {
    id: 'unsupported-transaction',
    description: 'Proyecto con runTransaction se convierte en mutación de dominio atómica',
    sourcePath: join(regressionRoot, 'fixtures', 'unsupported-transaction'),
    expectations: {
      success: true,
      validationValid: true,
      verificationReady: true,
      operationsUntransformed: 0,
      contentAssertions: [
        {
          file: 'app.js',
          includes: ["Funimas.domain.execute('transferCredits'"],
          excludes: ['runTransaction'],
        },
        {
          file: 'runtime/domain/mutations.ts',
          includes: ['"increment"', '"param": "amount"', '"sign": -1', '"sign": 1'],
          excludes: ['$fromSnap.data().balance'],
        },
      ],
    },
  },
  {
    id: 'unsupported-batch',
    description: 'Proyecto con writeBatch se convierte en mutación de dominio atómica',
    sourcePath: join(regressionRoot, 'fixtures', 'unsupported-batch'),
    expectations: {
      success: true,
      validationValid: true,
      verificationReady: true,
      operationsUntransformed: 0,
      contentAssertions: [
        {
          file: 'app.js',
          includes: ["Funimas.domain.execute('syncUserProfile'"],
          excludes: ['writeBatch', 'batch.commit'],
        },
      ],
    },
  },
  {
    id: 'auth-bootstrap-reads',
    description: 'Funciones con getDoc condicional no se reemplazan por mutación de dominio completa',
    sourcePath: join(regressionRoot, 'fixtures', 'auth-bootstrap-reads'),
    expectations: {
      success: true,
      validationValid: true,
      verificationReady: true,
      contentAssertions: [
        {
          file: 'js/auth.js',
          includes: [
            'bootstrapMissingCompanyData',
            'if (!userSnap.exists())',
            'if (!companySnap.exists())',
          ],
          excludes: ["Funimas.domain.execute('bootstrapMissingCompanyData'"],
        },
        {
          file: 'runtime/domain/mutations.ts',
          includes: ['DOMAIN_MUTATIONS'],
          excludes: ['"bootstrapMissingCompanyData"'],
        },
      ],
    },
  },
  {
    id: 'auth-register-listener',
    description: 'Registro multi-documento dentro de addEventListener se convierte en mutación de dominio',
    sourcePath: join(regressionRoot, 'fixtures', 'auth-register-listener'),
    expectations: {
      success: true,
      validationValid: true,
      verificationReady: true,
      operationsUntransformed: 0,
      contentAssertions: [
        {
          file: 'js/auth.js',
          includes: ["Funimas.domain.execute('registerCompany'"],
          excludes: ['setDoc(doc(db, \'users\'', 'merge: true'],
        },
        {
          file: 'runtime/domain/mutations.ts',
          includes: ['"registerCompany"', '"$email"', '"$companyId"', '"$businessName"'],
        },
      ],
    },
  },
];

export async function runProtectFixture(
  fixture: RegressionFixtureDefinition,
): Promise<RegressionRunResult> {
  const projectDir = await mkdtemp(join(tmpdir(), `funimas-regression-${fixture.id}-`));

  try {
    await cp(fixture.sourcePath, projectDir, { recursive: true });

    const pipeline = new ProtectPipeline({
      projectPath: projectDir,
      output: new NullOutputWriter(),
    });

    const result = await pipeline.execute();
    const summaryPath = join(result.workspaceResult.workspaceProject, '.funimas', 'reports', 'summary.json');
    const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as Record<string, unknown>;

    return {
      fixtureId: fixture.id,
      projectDir,
      result,
      summary,
    };
  } catch (error) {
    await rm(projectDir, { recursive: true, force: true });
    await rm(`${projectDir}_funimas`, { recursive: true, force: true });
    throw error;
  }
}

export async function cleanupRegressionRun(run: RegressionRunResult): Promise<void> {
  await rm(run.projectDir, { recursive: true, force: true });
  await rm(`${run.projectDir}_funimas`, { recursive: true, force: true });
}

export async function assertRegressionExpectations(
  run: RegressionRunResult,
  expectations: RegressionFixtureExpectations,
): Promise<void> {
  const { result, summary } = run;
  const workspacePath = result.workspaceResult.workspaceProject;

  if (result.success !== expectations.success) {
    throw new Error(
      `success: expected ${expectations.success}, got ${result.success} (verification=${result.verificationReport?.ready})`,
    );
  }

  if (result.validationResult.valid !== expectations.validationValid) {
    throw new Error(
      `validationValid: expected ${expectations.validationValid}, got ${result.validationResult.valid}`,
    );
  }

  if ((result.verificationReport?.ready ?? false) !== expectations.verificationReady) {
    throw new Error(
      `verificationReady: expected ${expectations.verificationReady}, got ${result.verificationReport?.ready}`,
    );
  }

  if (expectations.operationsUntransformed !== undefined) {
    const actual = Number(summary.operationsUntransformed ?? -1);

    if (actual !== expectations.operationsUntransformed) {
      throw new Error(
        `operationsUntransformed: expected ${expectations.operationsUntransformed}, got ${actual}`,
      );
    }
  }

  if (expectations.filesMustExist) {
    const { stat } = await import('node:fs/promises');

    for (const relativePath of expectations.filesMustExist) {
      await stat(join(workspacePath, relativePath));
    }
  }

  if (expectations.contentAssertions) {
    for (const assertion of expectations.contentAssertions) {
      const content = await readFile(join(workspacePath, assertion.file), 'utf8');

      for (const snippet of assertion.includes) {
        if (!content.includes(snippet)) {
          throw new Error(`${assertion.file} debe incluir: ${snippet}`);
        }
      }

      for (const snippet of assertion.excludes ?? []) {
        if (content.includes(snippet)) {
          throw new Error(`${assertion.file} no debe incluir: ${snippet}`);
        }
      }
    }
  }
}
