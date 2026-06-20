import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { DeployReadinessChecker } from '../deploy/deploy-readiness-checker.js';
import { TransformationHistory } from '../history/TransformationHistory.js';
import { GraphBuilder } from '../graph/GraphBuilder.js';
import { AstParser } from '../parser/AstParser.js';
import { ProjectScanner } from '../scanner/ProjectScanner.js';
import {
  analyzeUntransformedOperations,
  hasBlockingUntransformedOperations,
  type UntransformedOperationFinding,
} from '../report/untransformed-operations-analyzer.js';
import { CompositeWriteDetector } from '../domain/CompositeWriteDetector.js';
import { SemanticAnalyzer } from '../semantic/index.js';
import { SemanticResult } from '../semantic/SemanticResult.js';

const execFileAsync = promisify(execFile);

export interface FunctionalCheck {
  id: string;
  name: string;
  passed: boolean;
  level: 'error' | 'warning';
  message: string;
  durationMs?: number;
}

export interface WorkspaceVerificationReport {
  ready: boolean;
  workspacePath: string;
  checks: FunctionalCheck[];
  untransformedOperations: UntransformedOperationFinding[];
  durationMs: number;
  finishedAt: Date;
}

export interface WorkspaceVerifierOptions {
  skipBuild?: boolean;
  skipDeployReadiness?: boolean;
  requireEnv?: boolean;
  deployReadinessChecker?: DeployReadinessChecker;
  runCommand?: (
    command: string,
    args: string[],
    cwd: string,
  ) => Promise<{ stdout: string; stderr: string }>;
}

const REQUIRED_WORKSPACE_FILES = [
  'runtime/handler.ts',
  'sdk/index.ts',
  'funimas.config.json',
  'firestore.rules',
] as const;

export class WorkspaceVerifier {
  private readonly deployReadinessChecker: DeployReadinessChecker;
  private readonly runCommand: (
    command: string,
    args: string[],
    cwd: string,
  ) => Promise<{ stdout: string; stderr: string }>;

  constructor(options: WorkspaceVerifierOptions = {}) {
    this.deployReadinessChecker =
      options.deployReadinessChecker ?? new DeployReadinessChecker();
    this.runCommand =
      options.runCommand ??
      (async (command, args, cwd) => execFileAsync(command, args, { cwd, maxBuffer: 10 * 1024 * 1024 }));
  }

  async verify(
    workspacePath: string,
    options: WorkspaceVerifierOptions = {},
  ): Promise<WorkspaceVerificationReport> {
    const startedAt = Date.now();
    const resolvedPath = resolve(workspacePath);
    const checks: FunctionalCheck[] = [];

    checks.push(await this.checkWorkspaceStructure(resolvedPath));

    const untransformedResult = await this.checkUntransformedOperations(resolvedPath);
    checks.push(untransformedResult.check);
    const untransformedOperations = untransformedResult.findings;

    if (!options.skipDeployReadiness) {
      checks.push(await this.checkDeployReadiness(resolvedPath, options.requireEnv ?? true));
    }

    if (!options.skipBuild) {
      checks.push(await this.checkBuild(resolvedPath));
    }

    const ready = checks.every((check) => check.passed || check.level === 'warning');
    const finishedAt = new Date();

    return {
      ready,
      workspacePath: resolvedPath,
      checks,
      untransformedOperations,
      durationMs: finishedAt.getTime() - startedAt,
      finishedAt,
    };
  }

  private async checkWorkspaceStructure(workspacePath: string): Promise<FunctionalCheck> {
    const startedAt = Date.now();
    const missing: string[] = [];

    for (const relativePath of REQUIRED_WORKSPACE_FILES) {
      try {
        await access(join(workspacePath, relativePath));
      } catch {
        missing.push(relativePath);
      }
    }

    if (missing.length > 0) {
      return {
        id: 'workspace-structure',
        name: 'Estructura del workspace',
        passed: false,
        level: 'error',
        message: `Faltan archivos esenciales: ${missing.join(', ')}`,
        durationMs: Date.now() - startedAt,
      };
    }

    return {
      id: 'workspace-structure',
      name: 'Estructura del workspace',
      passed: true,
      level: 'error',
      message: 'Runtime, SDK y configuración Funimas presentes',
      durationMs: Date.now() - startedAt,
    };
  }

  private async checkUntransformedOperations(workspacePath: string): Promise<{
    check: FunctionalCheck;
    findings: UntransformedOperationFinding[];
  }> {
    const startedAt = Date.now();

    try {
      const history = new TransformationHistory(workspacePath);
      await history.initialize();

      const parseResult = await new AstParser().parse(workspacePath);
      const scanResult = await new ProjectScanner().scan(parseResult.project);
      const graphResult = new GraphBuilder().build(scanResult);
      const semanticResult = await new SemanticAnalyzer().analyze(graphResult);
      const domainMutations = await new CompositeWriteDetector().detect(workspacePath, semanticResult);
      const semanticWithMutations = new SemanticResult({
        operations: semanticResult.operations,
        totalOperations: semanticResult.totalOperations,
        operationsByType: semanticResult.operationsByType,
        startedAt: semanticResult.startedAt,
        finishedAt: semanticResult.finishedAt,
        domainMutations,
      });
      const findings = analyzeUntransformedOperations({
        workspacePath,
        semanticResult: semanticWithMutations,
        records: history.getRecords(),
        domainMutationOperationKeys: new Set(
          domainMutations.flatMap((mutation) => mutation.operationKeys),
        ),
      });

      if (findings.length === 0) {
        return {
          findings,
          check: {
            id: 'untransformed-operations',
            name: 'Operaciones Firestore',
            passed: true,
            level: 'error',
            message: 'Todas las operaciones Firestore detectadas fueron transformadas o son intencionalmente del cliente',
            durationMs: Date.now() - startedAt,
          },
        };
      }

      const blocking = hasBlockingUntransformedOperations(findings);

      return {
        findings,
        check: {
          id: 'untransformed-operations',
          name: 'Operaciones Firestore',
          passed: !blocking,
          level: 'error',
          message: blocking
            ? `${findings.length} operación(es) quedaron sin transformar en el cliente`
            : `${findings.length} operación(es) informativas sin transformar`,
          durationMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        findings: [],
        check: {
          id: 'untransformed-operations',
          name: 'Operaciones Firestore',
          passed: false,
          level: 'error',
          message: `No se pudo analizar operaciones sin transformar: ${message}`,
          durationMs: Date.now() - startedAt,
        },
      };
    }
  }

  private async checkDeployReadiness(
    workspacePath: string,
    requireEnv: boolean,
  ): Promise<FunctionalCheck> {
    const startedAt = Date.now();
    const report = await this.deployReadinessChecker.check(workspacePath);
    const errors = report.checks.filter((check) => !check.passed && check.level === 'error');
    const warnings = report.checks.filter((check) => !check.passed && check.level === 'warning');

    if (errors.length > 0) {
      return {
        id: 'deploy-readiness',
        name: 'Preparación para despliegue',
        passed: false,
        level: 'error',
        message: errors.map((check) => check.message).join('; '),
        durationMs: Date.now() - startedAt,
      };
    }

    if (warnings.length > 0 && requireEnv) {
      return {
        id: 'deploy-readiness',
        name: 'Preparación para despliegue',
        passed: false,
        level: 'warning',
        message: warnings.map((check) => check.message).join('; '),
        durationMs: Date.now() - startedAt,
      };
    }

    if (warnings.length > 0) {
      return {
        id: 'deploy-readiness',
        name: 'Preparación para despliegue',
        passed: true,
        level: 'warning',
        message: warnings.map((check) => check.message).join('; '),
        durationMs: Date.now() - startedAt,
      };
    }

    return {
      id: 'deploy-readiness',
      name: 'Preparación para despliegue',
      passed: true,
      level: 'warning',
      message: 'Configuración de despliegue lista',
      durationMs: Date.now() - startedAt,
    };
  }

  private async checkBuild(workspacePath: string): Promise<FunctionalCheck> {
    const startedAt = Date.now();

    try {
      const packageJson = JSON.parse(
        await readFile(join(workspacePath, 'package.json'), 'utf8'),
      ) as { scripts?: Record<string, string> };

      if (!packageJson.scripts?.build) {
        return {
          id: 'npm-build',
          name: 'Build del workspace',
          passed: true,
          level: 'warning',
          message: 'Sin script build en package.json; se omitió la compilación',
          durationMs: Date.now() - startedAt,
        };
      }
    } catch {
      return {
        id: 'npm-build',
        name: 'Build del workspace',
        passed: false,
        level: 'error',
        message: 'No se encontró package.json en el workspace',
        durationMs: Date.now() - startedAt,
      };
    }

    try {
      try {
        await access(join(workspacePath, 'node_modules'));
      } catch {
        await this.runCommand('npm', ['install', '--no-audit', '--no-fund'], workspacePath);
      }

      const { stderr } = await this.runCommand('npm', ['run', 'build'], workspacePath);

      return {
        id: 'npm-build',
        name: 'Build del workspace',
        passed: true,
        level: 'error',
        message: stderr.trim().length > 0 ? `Build OK (${stderr.trim()})` : 'Build completado sin errores',
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        id: 'npm-build',
        name: 'Build del workspace',
        passed: false,
        level: 'error',
        message: `Build falló: ${message}`,
        durationMs: Date.now() - startedAt,
      };
    }
  }
}
