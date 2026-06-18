import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { TransformationRecord } from '../history/TransformationRecord.js';
import { RollbackAction } from './RollbackAction.js';
import { RollbackContext } from './RollbackContext.js';
import { RollbackResult } from './RollbackResult.js';

export interface RollbackManagerOptions {
  now?: () => Date;
}

export interface RollbackManagerService {
  rollback(transformationId: string, context: RollbackContext): Promise<RollbackResult>;
  rollbackMany(transformationIds: string[], context: RollbackContext): Promise<RollbackResult[]>;
}

export class RollbackManager implements RollbackManagerService {
  private readonly now: () => Date;

  constructor(options: RollbackManagerOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async rollback(transformationId: string, context: RollbackContext): Promise<RollbackResult> {
    const startedAt = this.now();
    const record = context.history.getById(transformationId);

    if (!record) {
      const finishedAt = this.now();

      return new RollbackResult({
        success: false,
        transformationId,
        actions: [],
        reason: `Transformación no encontrada: ${transformationId}`,
        startedAt,
        finishedAt,
      });
    }

    if (record.rollbackExecuted) {
      const finishedAt = this.now();

      return new RollbackResult({
        success: true,
        transformationId,
        actions: [],
        reason: 'Rollback ya ejecutado previamente',
        startedAt,
        finishedAt,
      });
    }

    const actions = await this.executeRollback(record, context);
    const success = actions.length > 0 || record.before.length === 0;

    await context.history.updateRecord(transformationId, {
      rollbackExecuted: true,
      rollbackReason: context.reason,
      validationStatus: 'FAILED',
      status: 'FAILED',
    });

    const finishedAt = this.now();

    return new RollbackResult({
      success,
      transformationId,
      actions,
      reason: context.reason,
      startedAt,
      finishedAt,
    });
  }

  async rollbackMany(
    transformationIds: string[],
    context: RollbackContext,
  ): Promise<RollbackResult[]> {
    const results: RollbackResult[] = [];

    for (const transformationId of transformationIds) {
      results.push(await this.rollback(transformationId, context));
    }

    return results;
  }

  private async executeRollback(
    record: TransformationRecord,
    context: RollbackContext,
  ): Promise<RollbackAction[]> {
    const actions: RollbackAction[] = [];
    const workspaceRoot = resolve(context.workspacePath);

    if (record.before.length > 0 && record.after.length > 0) {
      const content = await readFile(record.file, 'utf8');

      if (!content.includes(record.after)) {
        return actions;
      }

      const restored = content.replace(record.after, record.before);
      await writeFile(record.file, restored, 'utf8');
      await this.restoreImportsForSnippet(record.file, record.before);

      actions.push(
        new RollbackAction({
          type: 'RESTORE_SNIPPET',
          file: record.file,
          transformationId: record.id,
          description: `Restaurado fragmento en ${record.file}`,
        }),
      );

      return actions;
    }

    const pathsToDelete = new Set<string>();

    if (record.file.startsWith(workspaceRoot)) {
      pathsToDelete.add(record.file);
    }

    for (const generatedFile of record.generatedFiles) {
      pathsToDelete.add(join(workspaceRoot, generatedFile));
    }

    for (const absolutePath of pathsToDelete) {
      try {
        await access(absolutePath);
        await rm(absolutePath, { force: true });
        actions.push(
          new RollbackAction({
            type: 'DELETE_GENERATED',
            file: absolutePath,
            transformationId: record.id,
            description: `Eliminado archivo generado ${absolutePath}`,
          }),
        );
      } catch {
        continue;
      }
    }

    return actions;
  }

  private async restoreImportsForSnippet(filePath: string, beforeSnippet: string): Promise<void> {
    if (!beforeSnippet.includes('addDoc') && !beforeSnippet.includes('collection')) {
      return;
    }

    const { Project } = await import('ts-morph');
    const project = new Project({ skipAddingFilesFromTsConfig: true });
    const sourceFile = project.addSourceFileAtPath(filePath);
    const firestoreImport = sourceFile
      .getImportDeclarations()
      .find((declaration) => declaration.getModuleSpecifierValue() === 'firebase/firestore');

    if (firestoreImport) {
      const names = new Set(firestoreImport.getNamedImports().map((entry) => entry.getName()));

      if (beforeSnippet.includes('addDoc') && !names.has('addDoc')) {
        firestoreImport.addNamedImport('addDoc');
      }

      if (beforeSnippet.includes('collection') && !names.has('collection')) {
        firestoreImport.addNamedImport('collection');
      }
    } else if (beforeSnippet.includes('addDoc') || beforeSnippet.includes('collection')) {
      sourceFile.addImportDeclaration({
        namedImports: [
          ...(beforeSnippet.includes('addDoc') ? ['addDoc'] : []),
          ...(beforeSnippet.includes('collection') ? ['collection'] : []),
        ],
        moduleSpecifier: 'firebase/firestore',
      });
    }

    const funimasImport = sourceFile
      .getImportDeclarations()
      .find((declaration) => declaration.getModuleSpecifierValue() === '@funimas/sdk');

    if (funimasImport && !sourceFile.getFullText().includes('Funimas.')) {
      funimasImport.remove();
    }

    sourceFile.saveSync();
  }
}
