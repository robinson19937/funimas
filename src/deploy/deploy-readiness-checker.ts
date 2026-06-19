import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  hasApiRedirect,
  hasFunctionsBundlerConfig,
  hasFunctionsDir,
} from '../utils/netlify-config-patcher.js';

export interface EnvValidationIssue {
  variable: string;
  level: 'error' | 'warning';
  message: string;
}

export interface EnvValidationResult {
  valid: boolean;
  issues: EnvValidationIssue[];
}

const REQUIRED_SERVER_VARS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;

const RECOMMENDED_CLIENT_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FUNIMAS_API_URL',
] as const;

export function parseEnvFile(content: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');

    values.set(key, value);
  }

  return values;
}

export function validateEnvValues(values: Map<string, string>): EnvValidationResult {
  const issues: EnvValidationIssue[] = [];

  for (const variable of REQUIRED_SERVER_VARS) {
    const value = values.get(variable);

    if (!value || value.includes('your-') || value.includes('...')) {
      issues.push({
        variable,
        level: 'error',
        message: `Falta o no está configurada: ${variable}`,
      });
    }
  }

  const privateKey = values.get('FIREBASE_PRIVATE_KEY');

  if (privateKey && !privateKey.includes('BEGIN PRIVATE KEY')) {
    issues.push({
      variable: 'FIREBASE_PRIVATE_KEY',
      level: 'warning',
      message: 'FIREBASE_PRIVATE_KEY no parece una clave PEM válida.',
    });
  }

  for (const variable of RECOMMENDED_CLIENT_VARS) {
    const value = values.get(variable);

    if (!value || value.includes('your-')) {
      issues.push({
        variable,
        level: 'warning',
        message: `Recomendado para build del cliente: ${variable}`,
      });
    }
  }

  return {
    valid: issues.every((issue) => issue.level !== 'error'),
    issues,
  };
}

export interface DeployReadinessCheck {
  name: string;
  passed: boolean;
  level: 'error' | 'warning';
  message: string;
}

export interface DeployReadinessReport {
  ready: boolean;
  checks: DeployReadinessCheck[];
}

/**
 * Valida que un workspace Funimas esté listo para desplegar.
 */
export class DeployReadinessChecker {
  async check(workspacePath: string): Promise<DeployReadinessReport> {
    const checks: DeployReadinessCheck[] = [];

    checks.push(await this.checkFile(workspacePath, 'firebase.json', 'error'));
    checks.push(await this.checkFile(workspacePath, 'firestore.rules', 'error'));
    checks.push(await this.checkFile(workspacePath, 'funimas.config.json', 'error'));
    checks.push(await this.checkNetlifyToml(workspacePath));
    checks.push(await this.checkEnvFile(workspacePath));
    checks.push(await this.checkConfigCollections(workspacePath));

    const ready = checks.every((check) => check.passed || check.level === 'warning');

    return { ready, checks };
  }

  private async checkFile(
    workspacePath: string,
    fileName: string,
    level: 'error' | 'warning',
  ): Promise<DeployReadinessCheck> {
    try {
      await access(join(workspacePath, fileName));

      return {
        name: fileName,
        passed: true,
        level,
        message: `${fileName} presente`,
      };
    } catch {
      return {
        name: fileName,
        passed: false,
        level,
        message: `Falta ${fileName}. Ejecuta funimas protect primero.`,
      };
    }
  }

  private async checkNetlifyToml(workspacePath: string): Promise<DeployReadinessCheck> {
    const filePath = join(workspacePath, 'netlify.toml');

    try {
      const content = await readFile(filePath, 'utf8');
      const issues: string[] = [];

      if (!hasFunctionsDir(content)) {
        issues.push('functions = "netlify/functions"');
      }

      if (!hasApiRedirect(content)) {
        issues.push('redirect /api/* → funimas');
      }

      if (!hasFunctionsBundlerConfig(content)) {
        issues.push('[functions] external_node_modules = ["firebase-admin"]');
      }

      if (issues.length > 0) {
        return {
          name: 'netlify.toml',
          passed: false,
          level: 'warning',
          message: `netlify.toml incompleto: ${issues.join(', ')}`,
        };
      }

      return {
        name: 'netlify.toml',
        passed: true,
        level: 'warning',
        message: 'netlify.toml configurado para Funimas',
      };
    } catch {
      return {
        name: 'netlify.toml',
        passed: false,
        level: 'warning',
        message: 'Sin netlify.toml (necesario para despliegue Netlify)',
      };
    }
  }

  private async checkEnvFile(workspacePath: string): Promise<DeployReadinessCheck> {
    const envPath = join(workspacePath, '.env');

    try {
      const content = await readFile(envPath, 'utf8');
      const validation = validateEnvValues(parseEnvFile(content));

      if (!validation.valid) {
        const errors = validation.issues
          .filter((issue) => issue.level === 'error')
          .map((issue) => issue.variable)
          .join(', ');

        return {
          name: '.env',
          passed: false,
          level: 'error',
          message: `Variables incompletas: ${errors}`,
        };
      }

      const warnings = validation.issues.filter((issue) => issue.level === 'warning');

      if (warnings.length > 0) {
        return {
          name: '.env',
          passed: true,
          level: 'warning',
          message: `Variables cliente pendientes: ${warnings.map((issue) => issue.variable).join(', ')}`,
        };
      }

      return {
        name: '.env',
        passed: true,
        level: 'error',
        message: '.env configurado',
      };
    } catch {
      return {
        name: '.env',
        passed: false,
        level: 'error',
        message: 'Falta .env. Copia .env.example y completa las credenciales.',
      };
    }
  }

  private async checkConfigCollections(workspacePath: string): Promise<DeployReadinessCheck> {
    const configPath = join(workspacePath, 'funimas.config.json');

    try {
      const config = JSON.parse(await readFile(configPath, 'utf8')) as {
        allowedCollections?: string[];
      };

      if (!Array.isArray(config.allowedCollections) || config.allowedCollections.length === 0) {
        return {
          name: 'allowedCollections',
          passed: false,
          level: 'warning',
          message: 'funimas.config.json no define colecciones permitidas.',
        };
      }

      return {
        name: 'allowedCollections',
        passed: true,
        level: 'warning',
        message: `Colecciones permitidas: ${config.allowedCollections.join(', ')}`,
      };
    } catch {
      return {
        name: 'allowedCollections',
        passed: false,
        level: 'warning',
        message: 'No se pudo leer funimas.config.json',
      };
    }
  }
}
