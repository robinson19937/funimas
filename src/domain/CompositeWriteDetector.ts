import { relative, resolve } from 'node:path';

import {
  Node,
  SyntaxKind,
  type CallExpression,
  type FunctionDeclaration,
  type SourceFile,
} from 'ts-morph';

import { TsMorphProjectLoader } from '../parser/TsMorphProjectLoader.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';
import {
  extractDocReference,
  extractDocumentPath,
  resolveCallExpression,
} from '../rewriter/firestore-rewrite-utils.js';
import { extractCollectionName } from '../rewriter/rewrite-utils.js';

import {
  type DomainMutation,
  type DomainWrite,
  type DomainWriteKind,
  isGeneratedWorkspaceFile,
  operationKey,
} from './DomainMutation.js';
import {
  buildDataTemplate,
  collectParamNames,
  segmentArgsToPathTemplate,
} from './write-template-builder.js';
import {
  findWriteClustersInBlock,
  inferAnonymousMutationId,
} from './write-cluster-utils.js';

interface FunctionCandidate {
  name: string;
  params: string[];
  invokeParams: string[];
  body: Node | undefined;
  startLine: number;
  filePath: string;
}

interface DetectedWrite {
  line: number;
  column: number;
  write: DomainWrite;
}

interface WriteHandles {
  transaction: Set<string>;
  batch: Set<string>;
}

export class CompositeWriteDetector {
  async detect(workspacePath: string, _semanticResult: SemanticResult): Promise<DomainMutation[]> {
    const resolvedWorkspace = resolve(workspacePath);
    const project = await new TsMorphProjectLoader().load(resolvedWorkspace);
    const mutations: DomainMutation[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      const relativeFile = relative(resolvedWorkspace, sourceFile.getFilePath());

      if (isGeneratedWorkspaceFile(relativeFile)) {
        continue;
      }

      for (const candidate of this.collectFunctionCandidates(sourceFile)) {
        const handles = this.collectWriteHandles(candidate);
        const writes = this.collectWrites(candidate, handles);

        if (writes.length < 2) {
          continue;
        }

        if (candidate.name.startsWith('anonymous_')) {
          const writeLineSet = new Set(writes.map((entry) => entry.line));
          const clusters = this.findWriteClusters(candidate, writeLineSet);

          for (const cluster of clusters) {
            if (cluster.length < 2) {
              continue;
            }

            mutations.push(
              this.buildMutation({
                sourceFile,
                candidate,
                cluster,
                replacementScope: 'statement-range',
              }),
            );
          }

          continue;
        }

        const operationKeys = writes.map((write) =>
          operationKey(sourceFile.getFilePath(), write.line),
        );

        for (const runTransactionLine of this.findRunTransactionLines(candidate)) {
          operationKeys.push(operationKey(sourceFile.getFilePath(), runTransactionLine));
        }

        for (const writeBatchLine of this.findWriteBatchLines(candidate)) {
          operationKeys.push(operationKey(sourceFile.getFilePath(), writeBatchLine));
        }

        for (const commitLine of this.findBatchCommitLines(candidate, handles.batch)) {
          operationKeys.push(operationKey(sourceFile.getFilePath(), commitLine));
        }

        const invokeParams = [...candidate.invokeParams];
        const params = [...candidate.params];
        const domainWrites = writes.map((entry) => entry.write);

        for (const write of domainWrites) {
          for (const segment of write.path) {
            if (typeof segment === 'object' && !params.includes(segment.param)) {
              params.push(segment.param);
            }
          }

          collectParamNames(params, write.dataTemplate);
        }

        mutations.push({
          id: candidate.name,
          file: sourceFile.getFilePath(),
          functionName: candidate.name,
          startLine: candidate.startLine,
          invokeParams,
          params,
          writes: domainWrites,
          operationKeys,
          replacementScope: 'function',
        });
      }
    }

    return mutations;
  }

  private collectFunctionCandidates(sourceFile: SourceFile): FunctionCandidate[] {
    const candidates: FunctionCandidate[] = [];

    for (const declaration of sourceFile.getFunctions()) {
      candidates.push(this.toFunctionCandidate(declaration, sourceFile));
    }

    for (const statement of sourceFile.getVariableStatements()) {
      for (const declaration of statement.getDeclarations()) {
        const initializer = declaration.getInitializer();

        if (!initializer) {
          continue;
        }

        if (
          initializer.getKind() === SyntaxKind.ArrowFunction ||
          initializer.getKind() === SyntaxKind.FunctionExpression
        ) {
          const name = declaration.getName() || `anonymous_${declaration.getStartLineNumber()}`;
          const functionLike =
            initializer.getKind() === SyntaxKind.ArrowFunction
              ? initializer.asKindOrThrow(SyntaxKind.ArrowFunction)
              : initializer.asKindOrThrow(SyntaxKind.FunctionExpression);

          const invokeParams = this.extractInvokeParams(functionLike.getParameters());

          candidates.push({
            name,
            params: [...invokeParams],
            invokeParams,
            body: functionLike.getBody(),
            startLine: declaration.getStartLineNumber(),
            filePath: sourceFile.getFilePath(),
          });
        }
      }
    }

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) {
        return;
      }

      const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);
      const expression = callExpression.getExpression();

      if (expression.getKind() !== SyntaxKind.PropertyAccessExpression) {
        return;
      }

      const propertyAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);

      if (propertyAccess.getName() !== 'addEventListener') {
        return;
      }

      const callback = callExpression.getArguments()[1];

      if (
        !callback ||
        (callback.getKind() !== SyntaxKind.ArrowFunction &&
          callback.getKind() !== SyntaxKind.FunctionExpression)
      ) {
        return;
      }

      const functionLike =
        callback.getKind() === SyntaxKind.ArrowFunction
          ? callback.asKindOrThrow(SyntaxKind.ArrowFunction)
          : callback.asKindOrThrow(SyntaxKind.FunctionExpression);

      const callbackName = `anonymous_${functionLike.getStartLineNumber()}`;

      if (candidates.some((candidate) => candidate.name === callbackName)) {
        return;
      }

      const invokeParams = this.extractInvokeParams(functionLike.getParameters());

      candidates.push({
        name: callbackName,
        params: [...invokeParams],
        invokeParams,
        body: functionLike.getBody(),
        startLine: functionLike.getStartLineNumber(),
        filePath: sourceFile.getFilePath(),
      });
    });

    return candidates;
  }

  private findWriteClusters(
    candidate: FunctionCandidate,
    writeLines: Set<number>,
  ): DetectedWrite[][] {
    if (!candidate.body || candidate.body.getKind() !== SyntaxKind.Block) {
      return [];
    }

    const writesByLine = new Map<number, DetectedWrite>();
    const handles = this.collectWriteHandles(candidate);
    const allWrites = this.collectWrites(candidate, handles);

    for (const write of allWrites) {
      writesByLine.set(write.line, write);
    }

    const clusters: DetectedWrite[][] = [];
    const rootBlock = candidate.body.asKindOrThrow(SyntaxKind.Block);

    for (const cluster of findWriteClustersInBlock(rootBlock, writeLines)) {
      const entries = cluster.lines
        .map((line) => writesByLine.get(line))
        .filter((entry): entry is DetectedWrite => entry !== undefined);

      if (entries.length >= 2) {
        clusters.push(entries);
      }
    }

    return clusters;
  }

  private buildMutation(options: {
    sourceFile: SourceFile;
    candidate: FunctionCandidate;
    cluster: DetectedWrite[];
    replacementScope: 'function' | 'statement-range';
  }): DomainMutation {
    const { sourceFile, candidate, cluster, replacementScope } = options;
    const clusterLines = cluster.map((entry) => entry.line);
    const domainWrites = cluster.map((entry) => entry.write);
    const operationKeys = clusterLines.map((line) => operationKey(sourceFile.getFilePath(), line));
    const params: string[] = [];
    const invokeParams: string[] = [];

    for (const write of domainWrites) {
      for (const segment of write.path) {
        if (typeof segment === 'object' && !params.includes(segment.param)) {
          params.push(segment.param);
        }
      }

      collectParamNames(params, write.dataTemplate);
    }

    invokeParams.push(...params);

    return {
      id: inferAnonymousMutationId(domainWrites, clusterLines[0] ?? candidate.startLine),
      file: sourceFile.getFilePath(),
      functionName: candidate.name,
      startLine: candidate.startLine,
      invokeParams,
      params,
      writes: domainWrites,
      operationKeys,
      replacementScope,
      statementStartLine: replacementScope === 'statement-range' ? clusterLines[0] : undefined,
      statementEndLine:
        replacementScope === 'statement-range' ? clusterLines[clusterLines.length - 1] : undefined,
    };
  }

  private toFunctionCandidate(
    declaration: FunctionDeclaration,
    sourceFile: SourceFile,
  ): FunctionCandidate {
    const invokeParams = this.extractInvokeParams(declaration.getParameters());

    return {
      name: declaration.getName() ?? `anonymous_${declaration.getStartLineNumber()}`,
      params: [...invokeParams],
      invokeParams,
      body: declaration.getBody(),
      startLine: declaration.getStartLineNumber(),
      filePath: sourceFile.getFilePath(),
    };
  }

  private extractInvokeParams(
    parameters: Array<import('ts-morph').ParameterDeclaration>,
  ): string[] {
    const invokeParams: string[] = [];

    for (const parameter of parameters) {
      const nameNode = parameter.getNameNode();

      if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
        for (const element of nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern).getElements()) {
          if (element.getKind() === SyntaxKind.BindingElement) {
            invokeParams.push(element.asKindOrThrow(SyntaxKind.BindingElement).getName());
          }
        }
        continue;
      }

      invokeParams.push(parameter.getName());
    }

    return invokeParams;
  }

  private collectWriteHandles(candidate: FunctionCandidate): WriteHandles {
    const transaction = new Set<string>(['transaction']);
    const batch = new Set<string>();

    if (!candidate.body) {
      return { transaction, batch };
    }

    candidate.body.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);

        if (callExpression.getExpression().getText() === 'runTransaction') {
          const callback = callExpression.getArguments()[1];

          if (callback) {
            const handleName = this.getCallbackParameterName(callback);

            if (handleName) {
              transaction.add(handleName);
            }
          }
        }
      }

      if (node.getKind() === SyntaxKind.VariableDeclaration) {
        const declaration = node.asKindOrThrow(SyntaxKind.VariableDeclaration);
        const initializer = declaration.getInitializer();

        if (
          initializer &&
          initializer.getKind() === SyntaxKind.CallExpression &&
          initializer.asKindOrThrow(SyntaxKind.CallExpression).getExpression().getText() ===
            'writeBatch'
        ) {
          const name = declaration.getName();

          if (name) {
            batch.add(name);
          }
        }
      }
    });

    return { transaction, batch };
  }

  private getCallbackParameterName(callback: Node): string | undefined {
    if (callback.getKind() === SyntaxKind.ArrowFunction) {
      return callback.asKindOrThrow(SyntaxKind.ArrowFunction).getParameters()[0]?.getName();
    }

    if (callback.getKind() === SyntaxKind.FunctionExpression) {
      return callback.asKindOrThrow(SyntaxKind.FunctionExpression).getParameters()[0]?.getName();
    }

    return undefined;
  }

  private collectWrites(candidate: FunctionCandidate, handles: WriteHandles): DetectedWrite[] {
    if (!candidate.body) {
      return [];
    }

    const writes: DetectedWrite[] = [];

    candidate.body.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) {
        return;
      }

      const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);
      const detected = this.extractWrite(callExpression, handles);

      if (!detected) {
        return;
      }

      writes.push({
        line: callExpression.getStartLineNumber(),
        column: callExpression.getStartLineNumber(),
        write: detected,
      });
    });

    return writes;
  }

  private findRunTransactionLines(candidate: FunctionCandidate): number[] {
    if (!candidate.body) {
      return [];
    }

    const lines: number[] = [];

    candidate.body.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) {
        return;
      }

      const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);

      if (callExpression.getExpression().getText() === 'runTransaction') {
        lines.push(callExpression.getStartLineNumber());
      }
    });

    return lines;
  }

  private findWriteBatchLines(candidate: FunctionCandidate): number[] {
    if (!candidate.body) {
      return [];
    }

    const lines: number[] = [];

    candidate.body.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) {
        return;
      }

      const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);

      if (callExpression.getExpression().getText() === 'writeBatch') {
        lines.push(callExpression.getStartLineNumber());
      }
    });

    return lines;
  }

  private findBatchCommitLines(candidate: FunctionCandidate, batchHandles: Set<string>): number[] {
    if (!candidate.body || batchHandles.size === 0) {
      return [];
    }

    const lines: number[] = [];

    candidate.body.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) {
        return;
      }

      const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);
      const calleeText = callExpression.getExpression().getText();
      const memberMatch = /^(\w+)\.commit$/.exec(calleeText);

      if (!memberMatch) {
        return;
      }

      if (batchHandles.has(memberMatch[1] ?? '')) {
        lines.push(callExpression.getStartLineNumber());
      }
    });

    return lines;
  }

  private extractWrite(callExpression: CallExpression, handles: WriteHandles): DomainWrite | null {
    const calleeText = callExpression.getExpression().getText();

    if (calleeText === 'addDoc') {
      const collection = extractCollectionName(callExpression);

      if (!collection) {
        return null;
      }

      return {
        kind: 'insert',
        path: [collection],
        dataTemplate: buildDataTemplate(callExpression.getArguments()[1]),
      };
    }

    if (calleeText === 'setDoc') {
      return this.extractDocWrite(callExpression, this.hasMergeOption(callExpression) ? 'upsert' : 'set');
    }

    if (calleeText === 'updateDoc') {
      return this.extractDocWrite(callExpression, 'update');
    }

    if (calleeText === 'deleteDoc') {
      return this.extractDocWrite(callExpression, 'delete');
    }

    const memberWrite = this.parseMemberWrite(calleeText, handles);

    if (memberWrite) {
      return this.extractDocWrite(callExpression, memberWrite);
    }

    return null;
  }

  private parseMemberWrite(calleeText: string, handles: WriteHandles): DomainWriteKind | null {
    const memberMatch = /^(\w+)\.(set|update|delete)$/.exec(calleeText);

    if (!memberMatch) {
      return null;
    }

    const [, handleName, method] = memberMatch;

    if (!handleName || !method) {
      return null;
    }

    if (handles.transaction.has(handleName) || handles.batch.has(handleName)) {
      return method as DomainWriteKind;
    }

    return null;
  }

  private extractDocWrite(callExpression: CallExpression, kind: DomainWriteKind): DomainWrite | null {
    const docReference = extractDocReference(callExpression);

    if (!docReference) {
      const refArgument = callExpression.getArguments()[0];
      const docCall = refArgument ? resolveCallExpression(refArgument) : undefined;
      const documentPath = docCall ? extractDocumentPath(docCall) : undefined;

      if (!documentPath) {
        return null;
      }

      return {
        kind,
        path: segmentArgsToPathTemplate(documentPath.segmentArgs).map((segment) =>
          segment.startsWith('$') ? { param: segment.slice(1) } : segment,
        ),
        dataTemplate:
          kind === 'delete' ? undefined : buildDataTemplate(callExpression.getArguments()[1]),
      };
    }

    return {
      kind,
      path: segmentArgsToPathTemplate(docReference.segmentArgs).map((segment) =>
        segment.startsWith('$') ? { param: segment.slice(1) } : segment,
      ),
      dataTemplate:
        kind === 'delete' ? undefined : buildDataTemplate(callExpression.getArguments()[1]),
    };
  }

  private hasMergeOption(callExpression: CallExpression): boolean {
    const options = callExpression.getArguments()[2];

    if (!options || options.getKind() !== SyntaxKind.ObjectLiteralExpression) {
      return false;
    }

    return options
      .asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
      .getProperties()
      .some((property) => {
        if (property.getKind() !== SyntaxKind.PropertyAssignment) {
          return false;
        }

        const assignment = property.asKindOrThrow(SyntaxKind.PropertyAssignment);
        return assignment.getName() === 'merge' && assignment.getInitializer()?.getText() === 'true';
      });
  }
}
