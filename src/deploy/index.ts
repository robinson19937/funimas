import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

export {
  DeployReadinessChecker,
  parseEnvFile,
  validateEnvValues,
  type DeployReadinessCheck,
  type DeployReadinessReport,
  type EnvValidationIssue,
  type EnvValidationResult,
} from './deploy-readiness-checker.js';

const execFileAsync = promisify(execFile);

export interface PrerequisiteCheck {
  name: string;
  available: boolean;
  version?: string;
  installHint: string;
}

export interface PrerequisiteReport {
  allRequiredMet: boolean;
  checks: PrerequisiteCheck[];
}

const REQUIRED_TOOLS = [
  { name: 'node', command: 'node', args: ['--version'], installHint: 'Instala Node.js 20+ desde https://nodejs.org' },
  { name: 'git', command: 'git', args: ['--version'], installHint: 'Instala Git desde https://git-scm.com' },
] as const;

const OPTIONAL_TOOLS = [
  {
    name: 'firebase',
    command: 'firebase',
    args: ['--version'],
    installHint: 'Opcional: deploy usa npx firebase-tools@latest automáticamente',
  },
  {
    name: 'netlify',
    command: 'netlify',
    args: ['--version'],
    installHint: 'Opcional: deploy usa npx netlify-cli@latest automáticamente',
  },
] as const;

/**
 * Verifica herramientas necesarias para setup y despliegue.
 */
export class PrerequisiteChecker {
  async check(): Promise<PrerequisiteReport> {
    const checks: PrerequisiteCheck[] = [];

    for (const tool of [...REQUIRED_TOOLS, ...OPTIONAL_TOOLS]) {
      checks.push(await this.checkTool(tool));
    }

    const allRequiredMet = checks
      .filter((check) => REQUIRED_TOOLS.some((tool) => tool.name === check.name))
      .every((check) => check.available);

    return { allRequiredMet, checks };
  }

  private async checkTool(tool: {
    name: string;
    command: string;
    args: readonly string[];
    installHint: string;
  }): Promise<PrerequisiteCheck> {
    try {
      const { stdout } = await execFileAsync(tool.command, tool.args, {
        timeout: 30_000,
      });

      return {
        name: tool.name,
        available: true,
        version: stdout.trim().split('\n')[0],
        installHint: tool.installHint,
      };
    } catch {
      return {
        name: tool.name,
        available: false,
        installHint: tool.installHint,
      };
    }
  }
}

export interface DeployOptions {
  workspacePath: string;
  production?: boolean;
  skipFirestore?: boolean;
  skipNetlify?: boolean;
  dryRun?: boolean;
  importEnv?: boolean;
}

export interface DeployStepResult {
  step: string;
  success: boolean;
  command: string;
  output?: string;
  error?: string;
}

export interface DeployResult {
  success: boolean;
  steps: DeployStepResult[];
}

/**
 * Orquesta despliegue de reglas Firestore y sitio Netlify vía CLI.
 */
export class DeployService {
  async deploy(options: DeployOptions): Promise<DeployResult> {
    const workspacePath = resolve(options.workspacePath);
    const steps: DeployStepResult[] = [];

    await this.assertWorkspaceReady(workspacePath);

    if (!options.skipFirestore) {
      steps.push(await this.deployFirestoreRules(workspacePath, options));
    }

    if (!options.skipNetlify) {
      if (options.importEnv) {
        steps.push(await this.importNetlifyEnv(workspacePath, options));
      }

      steps.push(await this.deployNetlify(workspacePath, options));
    }

    const success = steps.every((step) => step.success);

    return { success, steps };
  }

  private async assertWorkspaceReady(workspacePath: string): Promise<void> {
    await access(workspacePath);
    await access(join(workspacePath, 'firebase.json'));
    await access(join(workspacePath, 'firestore.rules'));
  }

  private async deployFirestoreRules(
    workspacePath: string,
    options: DeployOptions,
  ): Promise<DeployStepResult> {
    const projectId = await this.resolveFirebaseProjectId(workspacePath);
    const args = ['-y', 'firebase-tools@latest', 'deploy', '--only', 'firestore:rules'];

    if (projectId) {
      args.push('--project', projectId);
    }

    if (options.dryRun) {
      return {
        step: 'firestore:rules',
        success: true,
        command: `npx ${args.join(' ')}`,
        output: `Dry-run: se desplegarían reglas desde ${join(workspacePath, 'firestore.rules')}`,
      };
    }

    return this.runStep('firestore:rules', 'npx', args, workspacePath);
  }

  private async deployNetlify(
    workspacePath: string,
    options: DeployOptions,
  ): Promise<DeployStepResult> {
    const args = ['-y', 'netlify-cli@latest', 'deploy'];

    if (options.production) {
      args.push('--prod');
    }

    if (options.dryRun) {
      return {
        step: 'netlify',
        success: true,
        command: `npx ${args.join(' ')}`,
        output: `Dry-run: se desplegaría el workspace ${workspacePath}`,
      };
    }

    return this.runStep('netlify', 'npx', args, workspacePath);
  }

  private async importNetlifyEnv(
    workspacePath: string,
    options: DeployOptions,
  ): Promise<DeployStepResult> {
    const envPath = join(workspacePath, '.env');

    try {
      await access(envPath);
    } catch {
      return {
        step: 'netlify:env',
        success: true,
        command: 'netlify env:import .env',
        output: 'Omitido: no existe .env en el workspace',
      };
    }

    const args = ['-y', 'netlify-cli@latest', 'env:import', '.env'];

    if (options.dryRun) {
      return {
        step: 'netlify:env',
        success: true,
        command: `npx ${args.join(' ')}`,
        output: 'Dry-run: se importarían variables desde .env',
      };
    }

    return this.runStep('netlify:env', 'npx', args, workspacePath);
  }

  private async resolveFirebaseProjectId(workspacePath: string): Promise<string | undefined> {
    const envPath = join(workspacePath, '.env');

    try {
      const envContent = await readFile(envPath, 'utf8');

      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();

        if (trimmed.startsWith('FIREBASE_PROJECT_ID=')) {
          return trimmed.slice('FIREBASE_PROJECT_ID='.length).replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      // Sin .env: firebase CLI usará el proyecto activo.
    }

    return undefined;
  }

  private async runStep(
    step: string,
    command: string,
    args: string[],
    cwd: string,
  ): Promise<DeployStepResult> {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd,
        timeout: 600_000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        step,
        success: true,
        command: `${command} ${args.join(' ')}`,
        output: [stdout, stderr].filter(Boolean).join('\n').trim() || undefined,
      };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; message?: string };

      return {
        step,
        success: false,
        command: `${command} ${args.join(' ')}`,
        output: [execError.stdout, execError.stderr].filter(Boolean).join('\n').trim() || undefined,
        error: execError.message ?? 'Error desconocido',
      };
    }
  }
}
