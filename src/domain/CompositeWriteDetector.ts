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
        const writes = this.collectWrites(candidate);

        if (writes.length < 2) {
          continue;
        }

        const operationKeys = writes.map((write) =>
          operationKey(sourceFile.getFilePath(), write.line),
        );

        for (const runTransactionLine of this.findRunTransactionLines(candidate)) {
          operationKeys.push(operationKey(sourceFile.getFilePath(), runTransactionLine));
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
      const isExported = statement.isExported();

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

        if (!isExported && declaration.getName()) {
          // local functions are still candidates
        }
      }
    }

    return candidates;
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

  private collectWrites(candidate: FunctionCandidate): DetectedWrite[] {
    if (!candidate.body) {
      return [];
    }

    const writes: DetectedWrite[] = [];

    candidate.body.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) {
        return;
      }

      const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);
      const detected = this.extractWrite(callExpression);

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

  private extractWrite(callExpression: CallExpression): DomainWrite | null {
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

    if (
      calleeText === 'transaction.set' ||
      calleeText === 'transaction.update' ||
      calleeText === 'transaction.delete'
    ) {
      const kind = calleeText.split('.')[1] as DomainWriteKind;
      return this.extractDocWrite(callExpression, kind);
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
