import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

import {
  ADAPTER_FEATURE_LABELS,
  AdapterContext,
  createDefaultAdapterRegistry,
  type AdapterFeature,
  type AdapterRegistryDetectionResult,
  type AdapterRegistryService,
  type PlatformAdapter,
} from '../adapters/index.js';
import { BackupEngine, type BackupService } from '../backup/index.js';
import { GraphBuilder, type GraphBuilderService } from '../graph/index.js';
import type { GraphResult } from '../graph/GraphResult.js';
import {
  FunctionGenerator,
  GeneratorContext,
  GeneratedFileVerifier,
  GenerationVerificationError,
  SDKGenerator,
  WorkspaceConfigGenerator,
  type FunctionGeneratorService,
  type SDKGeneratorService,
} from '../generator/index.js';
import { DatabaseInsertFunctionGenerator } from '../generator/functions/DatabaseInsertFunctionGenerator.js';
import { FunimasFunctionGenerator } from '../generator/functions/FunimasFunctionGenerator.js';
import { TransformationHistory } from '../history/index.js';
import { ChangeReportGenerator, ValidationReportGenerator } from '../report/index.js';
import { TransformationBenefit } from '../report/TransformationBenefit.js';
import { TransformationReason } from '../report/TransformationReason.js';
import { RuntimeGenerator, RuntimeContext, SharedGenerator, type RuntimeGeneratorService, type SharedGeneratorService } from '../runtime/index.js';
import { CodeRewriter, RewriteContext, type CodeRewriterService } from '../rewriter/index.js';
import type { RewriteResult } from '../rewriter/RewriteResult.js';
import { TransformationPlanner, type TransformationPlannerService } from '../planner/index.js';
import { PlannerContext } from '../planner/PlannerContext.js';
import { isSupportedFunctionOperation } from '../generator/operation-utils.js';
import type { PlannerResult } from '../planner/PlannerResult.js';
import { AstParser, type AstParserService } from '../parser/index.js';
import { ProjectScanner, type ProjectScannerService } from '../scanner/index.js';
import type { ScanResult } from '../scanner/ScanResult.js';
import { SemanticAnalyzer, type SemanticAnalyzerService } from '../semantic/index.js';
import type { SemanticResult } from '../semantic/SemanticResult.js';
import { SemanticOperation } from '../semantic/SemanticOperation.js';
import { ConsoleOutputWriter, NullOutputWriter, type OutputWriter } from '../utils/index.js';
import { VERSION } from '../utils/version.js';
import { WorkspaceEngine, type WorkspaceService } from '../workspace/index.js';
import type { WorkspaceResult } from '../workspace/WorkspaceResult.js';
import { ValidationEngine, ValidationContext, type ValidationEngineService } from '../validation/index.js';
import { ValidationError } from '../validation/ValidationError.js';
import { ValidationResult } from '../validation/ValidationResult.js';
import { RollbackManager, RollbackContext, type RollbackManagerService } from '../rollback/index.js';
import type { ProtectPipelineResult } from './ProtectPipelineResult.js';

export interface ProtectPipelineOptions {
  projectPath: string;
  output?: OutputWriter;
  backupEngine?: BackupService;
  workspaceEngine?: WorkspaceService;
  astParser?: AstParserService;
  projectScanner?: ProjectScannerService;
  graphBuilder?: GraphBuilderService;
  semanticAnalyzer?: SemanticAnalyzerService;
  transformationPlanner?: TransformationPlannerService;
  adapterRegistry?: AdapterRegistryService;
  sdkGenerator?: SDKGeneratorService;
  functionGenerator?: FunctionGeneratorService;
  codeRewriter?: CodeRewriterService;
  backendRuntimeGenerator?: RuntimeGeneratorService;
  changeReportGenerator?: ChangeReportGenerator;
  validationReportGenerator?: ValidationReportGenerator;
  validationEngine?: ValidationEngineService;
  rollbackManager?: RollbackManagerService;
  databaseInsertFunctionGenerator?: DatabaseInsertFunctionGenerator;
  funimasFunctionGenerator?: FunimasFunctionGenerator;
  sharedGenerator?: SharedGeneratorService;
  generatedFileVerifier?: GeneratedFileVerifier;
  workspaceConfigGenerator?: WorkspaceConfigGenerator;
}

export class ProtectPipeline {
  private readonly projectPath: string;
  private readonly output: OutputWriter;
  private readonly backupEngine: BackupService;
  private readonly workspaceEngine: WorkspaceService;
  private readonly astParser: AstParserService;
  private readonly projectScanner: ProjectScannerService;
  private readonly graphBuilder: GraphBuilderService;
  private readonly semanticAnalyzer: SemanticAnalyzerService;
  private readonly transformationPlanner: TransformationPlannerService;
  private readonly adapterRegistry: AdapterRegistryService;
  private readonly sdkGenerator: SDKGeneratorService;
  private readonly functionGenerator: FunctionGeneratorService;
  private readonly codeRewriter: CodeRewriterService;
  private readonly backendRuntimeGenerator: RuntimeGeneratorService;
  private readonly changeReportGenerator: ChangeReportGenerator;
  private readonly validationReportGenerator: ValidationReportGenerator;
  private readonly validationEngine: ValidationEngineService;
  private readonly rollbackManager: RollbackManagerService;
  private readonly databaseInsertFunctionGenerator: DatabaseInsertFunctionGenerator;
  private readonly funimasFunctionGenerator: FunimasFunctionGenerator;
  private readonly sharedGenerator: SharedGeneratorService;
  private readonly generatedFileVerifier: GeneratedFileVerifier;
  private readonly workspaceConfigGenerator: WorkspaceConfigGenerator;
  private readonly executionId: string;

  constructor(options: ProtectPipelineOptions) {
    this.projectPath = resolve(options.projectPath);
    this.output = options.output ?? new ConsoleOutputWriter();
    this.backupEngine =
      options.backupEngine ?? new BackupEngine({ output: new NullOutputWriter() });
    this.workspaceEngine = options.workspaceEngine ?? new WorkspaceEngine();
    this.astParser = options.astParser ?? new AstParser();
    this.projectScanner = options.projectScanner ?? new ProjectScanner();
    this.graphBuilder = options.graphBuilder ?? new GraphBuilder();
    this.semanticAnalyzer = options.semanticAnalyzer ?? new SemanticAnalyzer();
    this.transformationPlanner = options.transformationPlanner ?? new TransformationPlanner();
    this.adapterRegistry = options.adapterRegistry ?? createDefaultAdapterRegistry();
    this.sdkGenerator = options.sdkGenerator ?? new SDKGenerator();
    this.functionGenerator = options.functionGenerator ?? new FunctionGenerator();
    this.codeRewriter = options.codeRewriter ?? new CodeRewriter();
    this.backendRuntimeGenerator = options.backendRuntimeGenerator ?? new RuntimeGenerator();
    this.changeReportGenerator = options.changeReportGenerator ?? new ChangeReportGenerator();
    this.validationReportGenerator =
      options.validationReportGenerator ?? new ValidationReportGenerator();
    this.validationEngine = options.validationEngine ?? new ValidationEngine();
    this.rollbackManager = options.rollbackManager ?? new RollbackManager();
    this.databaseInsertFunctionGenerator =
      options.databaseInsertFunctionGenerator ?? new DatabaseInsertFunctionGenerator();
    this.funimasFunctionGenerator =
      options.funimasFunctionGenerator ?? new FunimasFunctionGenerator();
    this.sharedGenerator = options.sharedGenerator ?? new SharedGenerator();
    this.generatedFileVerifier = options.generatedFileVerifier ?? new GeneratedFileVerifier();
    this.workspaceConfigGenerator =
      options.workspaceConfigGenerator ?? new WorkspaceConfigGenerator();
    this.executionId = randomUUID();
  }

  async execute(): Promise<ProtectPipelineResult> {
    const pipelineStartedAt = new Date();
    await this.backupEngine.create(this.projectPath);
    const workspaceResult = await this.workspaceEngine.create(this.projectPath);

    this.printWorkspaceSummary(workspaceResult);

    const parseResult = await this.astParser.parse(workspaceResult.workspaceProject);

    this.output.writeln('Analizando estructura...');
    this.output.writeln();

    const scanResult = await this.projectScanner.scan(parseResult.project);

    this.printScanSummary(scanResult);

    this.output.writeln('Construyendo Dependency Graph...');
    this.output.writeln();

    const graphResult = this.graphBuilder.build(scanResult);

    this.printGraphSummary(graphResult);

    this.output.writeln('Análisis semántico');
    this.output.writeln();

    const semanticResult = await this.semanticAnalyzer.analyze(graphResult);

    this.printSemanticSummary(semanticResult);

    this.output.writeln('Planificando transformación...');
    this.output.writeln();

    const plannerResult = this.transformationPlanner.plan(semanticResult);

    this.printPlannerSummary(plannerResult);

    this.output.writeln('Detectando plataforma...');
    this.output.writeln();

    const adapterDetection = await this.adapterRegistry.detect(
      new AdapterContext({
        projectPath: this.projectPath,
        workspacePath: workspaceResult.workspaceProject,
        semanticResult,
        plannerResult,
      }),
    );

    this.printAdapterSummary(adapterDetection);

    const history = new TransformationHistory(workspaceResult.workspaceProject);
    await history.initialize();

    let generationError: GenerationVerificationError | undefined;

    try {
      await this.runGenerationPhase({
        adapter: adapterDetection.adapter,
        adapterDetection,
        generatorContext: new GeneratorContext({
          projectPath: this.projectPath,
          workspacePath: workspaceResult.workspaceProject,
          semanticResult,
          adapter: adapterDetection.adapter,
        }),
        workspacePath: workspaceResult.workspaceProject,
        history,
      });
    } catch (error) {
      if (error instanceof GenerationVerificationError) {
        generationError = error;
        this.output.writeln('Error de generación');
        this.output.writeln();
        this.output.writeln(`✗ ${error.message}`);
        this.output.writeln();
      } else {
        throw error;
      }
    }

    if (generationError) {
      const pipelineFinishedAt = new Date();
      const durationMs = pipelineFinishedAt.getTime() - pipelineStartedAt.getTime();
      const reportsDirectory = join(workspaceResult.workspaceProject, '.funimas', 'reports');
      const validationResult = this.createGenerationFailureValidationResult(
        generationError,
        pipelineFinishedAt,
      );

      this.output.writeln('═══════════════════════════════════════');
      this.output.writeln('Funimas — Protección detenida');
      this.output.writeln('═══════════════════════════════════════');
      this.output.writeln();
      this.output.writeln('La generación de archivos falló antes de la validación.');
      this.output.writeln();

      return {
        success: false,
        executionId: this.executionId,
        projectPath: this.projectPath,
        workspaceResult,
        plannerResult,
        semanticResult,
        validationResult,
        durationMs,
        transformationsRegistered: history.getRecordCount(),
        reportsDirectory,
        generationError: generationError.message,
      };
    }

    this.output.writeln('Reescribiendo código...');
    this.output.writeln();

    const rewriteResult = await this.codeRewriter.rewrite(
      new RewriteContext({
        projectPath: this.projectPath,
        workspacePath: workspaceResult.workspaceProject,
        semanticResult,
        history,
      }),
    );

    this.printRewriteSummary(rewriteResult);

    this.output.writeln('Registrando transformaciones...');
    this.output.writeln();
    this.output.writeln(`✔ ${history.getRecordCount()} transformaciones registradas`);
    this.output.writeln();

    this.output.writeln('Validando Workspace...');
    this.output.writeln();

    const validationContext = new ValidationContext({
      projectPath: this.projectPath,
      workspacePath: workspaceResult.workspaceProject,
      history,
      semanticResult,
    });

    let validationResult = await this.validationEngine.validateContext(validationContext);
    const rollbackResults = [];

    this.printValidationSummary(validationResult);

    if (!validationResult.valid && validationResult.failedTransformationIds.length > 0) {
      this.output.writeln('Errores encontrados:');
      this.output.writeln();

      for (const error of validationResult.errors) {
        this.output.writeln(`- ${error.message}`);
        this.output.writeln();
      }

      const rollbackContext = new RollbackContext({
        workspacePath: workspaceResult.workspaceProject,
        history,
        reason: 'Validación fallida',
      });

      for (const transformationId of validationResult.failedTransformationIds) {
        const rollbackResult = await this.rollbackManager.rollback(
          transformationId,
          rollbackContext,
        );
        rollbackResults.push(rollbackResult);

        await history.updateRecord(transformationId, {
          validationStatus: 'FAILED',
          validationErrors: validationResult.errors
            .filter((error) => error.transformationId === transformationId)
            .map((error) => error.message),
        });
      }

      this.output.writeln('Rollback ejecutado correctamente.');
      this.output.writeln();

      validationResult = await this.validationEngine.validateContext(validationContext);
    } else if (validationResult.valid) {
      for (const record of history.getRecords()) {
        await history.updateRecord(record.id, {
          validationStatus: 'PASSED',
          executionTime: validationResult.duration,
        });
      }
    }

    this.output.writeln('Actualizando reporte de validación...');
    this.output.writeln();

    const validationFinishedAt = new Date();
    await this.validationReportGenerator.generate(
      workspaceResult.workspaceProject,
      validationResult,
      rollbackResults,
      this.executionId,
      validationFinishedAt,
    );

    this.output.writeln('✔ validation.md');
    this.output.writeln();
    this.output.writeln('✔ validation.html');
    this.output.writeln();
    this.output.writeln('✔ validation.json');
    this.output.writeln();

    this.output.writeln('Actualizando reporte...');
    this.output.writeln();

    const pipelineFinishedAt = new Date();
    await this.changeReportGenerator.generate(
      workspaceResult.workspaceProject,
      history,
      semanticResult,
      pipelineFinishedAt.getTime() - pipelineStartedAt.getTime(),
      pipelineFinishedAt,
      this.executionId,
    );

    this.output.writeln('✔ changes.md');
    this.output.writeln();
    this.output.writeln('✔ changes.html');
    this.output.writeln();
    this.output.writeln('✔ summary.json');
    this.output.writeln();

    const durationMs = pipelineFinishedAt.getTime() - pipelineStartedAt.getTime();
    const reportsDirectory = join(workspaceResult.workspaceProject, '.funimas', 'reports');

    this.printFinalSummary({
      workspaceResult,
      semanticResult,
      validationResult,
      durationMs,
      transformationsRegistered: history.getRecordCount(),
      reportsDirectory,
    });

    return {
      success: validationResult.valid,
      executionId: this.executionId,
      projectPath: this.projectPath,
      workspaceResult,
      plannerResult,
      semanticResult,
      validationResult,
      durationMs,
      transformationsRegistered: history.getRecordCount(),
      reportsDirectory,
    };
  }

  private printFinalSummary(summary: {
    workspaceResult: WorkspaceResult;
    semanticResult: SemanticResult;
    validationResult: ValidationResult;
    durationMs: number;
    transformationsRegistered: number;
    reportsDirectory: string;
  }): void {
    this.output.writeln('═══════════════════════════════════════');
    this.output.writeln('Funimas — Protección completada');
    this.output.writeln('═══════════════════════════════════════');
    this.output.writeln();
    this.output.writeln(`Proyecto original: ${summary.workspaceResult.originalProject}`);
    this.output.writeln(`Workspace: ${summary.workspaceResult.workspaceProject}`);
    this.output.writeln(`Operaciones detectadas: ${summary.semanticResult.totalOperations}`);
    this.output.writeln(`Transformaciones registradas: ${summary.transformationsRegistered}`);
    this.output.writeln(
      `Validación: ${summary.validationResult.valid ? 'OK' : 'CON ERRORES'}`,
    );
    this.output.writeln(`Duración: ${(summary.durationMs / 1000).toFixed(2)}s`);
    this.output.writeln(`Versión: ${VERSION}`);
    this.output.writeln(`Reportes: ${summary.reportsDirectory}`);
    this.output.writeln();

    if (summary.validationResult.valid) {
      this.output.writeln('Próximo paso para producción:');
      this.output.writeln();
      this.output.writeln(`  cd ${summary.workspaceResult.workspaceProject}`);
      this.output.writeln('  npm install');
      this.output.writeln('  netlify deploy');
      this.output.writeln();
    }
  }

  private printWorkspaceSummary(workspaceResult: WorkspaceResult): void {
    this.output.writeln('Funimas');
    this.output.writeln();
    this.output.writeln('✔ Backup creado');
    this.output.writeln();
    this.output.writeln('✔ Workspace creado');
    this.output.writeln();
    this.output.writeln('Proyecto original:');
    this.output.writeln();
    this.output.writeln(workspaceResult.originalProject);
    this.output.writeln();
    this.output.writeln('Proyecto de trabajo:');
    this.output.writeln();
    this.output.writeln(workspaceResult.workspaceProject);
    this.output.writeln();
  }

  private printScanSummary(scanResult: ScanResult): void {
    this.output.writeln(`✔ ${scanResult.totalFiles} archivos`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalImports} imports`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalFunctions} funciones`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalClasses} clases`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalInterfaces} interfaces`);
    this.output.writeln();
    this.output.writeln(`✔ ${scanResult.totalEnums} enums`);
    this.output.writeln();
  }

  private printGraphSummary(graphResult: GraphResult): void {
    this.output.writeln(`✔ Nodos: ${graphResult.totalNodes}`);
    this.output.writeln();
    this.output.writeln(`✔ Relaciones: ${graphResult.totalEdges}`);
    this.output.writeln();
    this.output.writeln(`✔ Componentes: ${graphResult.totalConnectedComponents}`);
    this.output.writeln();
  }

  private printSemanticSummary(semanticResult: SemanticResult): void {
    if (semanticResult.hasProvider('firebase')) {
      this.output.writeln('✔ Firebase detectado');
      this.output.writeln();
    }

    const firestoreOperations = semanticResult.getOperationsByMetadata('category', 'firestore');

    if (firestoreOperations.length > 0) {
      this.output.writeln('✔ Firestore');
      this.output.writeln(
        `Insert: ${this.countCategoryOperations(semanticResult, 'firestore', 'DATABASE_INSERT')}`,
      );
      this.output.writeln(
        `Update: ${this.countCategoryOperations(semanticResult, 'firestore', 'DATABASE_UPDATE')}`,
      );
      this.output.writeln(
        `Delete: ${this.countCategoryOperations(semanticResult, 'firestore', 'DATABASE_DELETE')}`,
      );
      this.output.writeln(
        `Read: ${this.countCategoryOperations(semanticResult, 'firestore', 'DATABASE_READ')}`,
      );
      this.output.writeln();
    }

    const authOperations = semanticResult.getOperationsByMetadata('category', 'auth');

    if (authOperations.length > 0) {
      this.output.writeln('✔ Authentication');
      this.output.writeln(
        `Login: ${this.countCategoryOperations(semanticResult, 'auth', 'AUTH_LOGIN')}`,
      );
      this.output.writeln(
        `Register: ${this.countCategoryOperations(semanticResult, 'auth', 'AUTH_REGISTER')}`,
      );
      this.output.writeln();
    }

    const storageOperations = semanticResult.getOperationsByMetadata('category', 'storage');

    if (storageOperations.length > 0) {
      this.output.writeln('✔ Storage');
      this.output.writeln(
        `Upload: ${this.countCategoryOperations(semanticResult, 'storage', 'FILE_UPLOAD')}`,
      );
    }
  }

  private countCategoryOperations(
    semanticResult: SemanticResult,
    category: string,
    type: SemanticOperation['type'],
  ): number {
    return semanticResult.operations.filter(
      (operation) => operation.metadata.category === category && operation.type === type,
    ).length;
  }

  private printPlannerSummary(plannerResult: PlannerResult): void {
    this.output.writeln(`✔ Acciones: ${plannerResult.totalActions}`);
    this.output.writeln();
    this.output.writeln(`✔ Runtime: ${plannerResult.actionsByType.GENERATE_RUNTIME}`);
    this.output.writeln();
    this.output.writeln(`✔ SDK: ${plannerResult.actionsByType.GENERATE_SDK}`);
    this.output.writeln();
    this.output.writeln(`✔ Functions: ${plannerResult.actionsByType.GENERATE_FUNCTION}`);
    this.output.writeln();
    this.output.writeln(`✔ Rewrites: ${plannerResult.actionsByType.REWRITE_CODE}`);
    this.output.writeln();
    this.output.writeln(`✔ Imports: ${plannerResult.actionsByType.UPDATE_IMPORTS}`);
    this.output.writeln();
    this.output.writeln(`✔ Validaciones: ${plannerResult.actionsByType.VALIDATE_PROJECT}`);
  }

  private printAdapterSummary(detection: AdapterRegistryDetectionResult): void {
    const attempts = detection.attempts ?? [];

    if (!detection.adapter) {
      this.output.writeln('✔ Plataforma no detectada');
      this.output.writeln();
      this.output.writeln('Motivo:');
      this.output.writeln();

      for (const attempt of attempts) {
        this.output.writeln(`- ${attempt.adapterName}: ${attempt.reason ?? 'sin coincidencias'}`);
        this.output.writeln();
      }

      this.output.writeln('Se continuará generando Runtime y SDK.');
      this.output.writeln();
      return;
    }

    const successfulAttempt = attempts.find((attempt) => attempt.detected);

    this.output.writeln(`✔ ${detection.adapter.name}`);
    this.output.writeln();

    if (successfulAttempt?.marker) {
      this.output.writeln(`Marcador: ${successfulAttempt.marker}`);
      this.output.writeln();
    }

    if (successfulAttempt?.foundAt) {
      this.output.writeln(`Ubicación: ${successfulAttempt.foundAt}`);
      this.output.writeln();
    }

    this.output.writeln('Capabilities');
    this.output.writeln();

    const displayFeatures: AdapterFeature[] = ['runtime', 'functions', 'environment'];

    for (const feature of displayFeatures) {
      if (detection.adapter.supports(feature)) {
        this.output.writeln(`✔ ${ADAPTER_FEATURE_LABELS[feature]}`);
        this.output.writeln();
      }
    }
  }

  private printValidationSummary(validationResult: ValidationResult): void {
    const ruleLabels: Record<string, string> = {
      'typescript-compilation': 'TypeScript',
      'missing-imports': 'Imports',
      'runtime-structure': 'Runtime',
      'sdk-structure': 'SDK',
      'generated-files': 'Functions',
      'missing-files': 'Missing Files',
    };

    for (const ruleResult of validationResult.ruleResults) {
      const label = ruleLabels[ruleResult.ruleId] ?? ruleResult.ruleName;

      if (ruleResult.passed) {
        this.output.writeln(`✔ ${label}`);
        this.output.writeln();
      }
    }

    this.output.writeln('Resultado:');
    this.output.writeln();

    if (validationResult.valid) {
      this.output.writeln('Sin errores');
      this.output.writeln();
      return;
    }

    this.output.writeln('Errores encontrados');
    this.output.writeln();
  }

  private async runGenerationPhase(options: {
    adapter?: PlatformAdapter;
    adapterDetection: AdapterRegistryDetectionResult;
    generatorContext: GeneratorContext;
    workspacePath: string;
    history: TransformationHistory;
  }): Promise<void> {
    const { adapter, adapterDetection, generatorContext, workspacePath, history } = options;

    this.output.writeln('Plan de generación:');
    this.output.writeln();
    this.output.writeln('✔ WorkspaceConfigGenerator — siempre');
    this.output.writeln();
    this.output.writeln('✔ RuntimeGenerator — siempre');
    this.output.writeln();
    this.output.writeln('✔ SharedGenerator — siempre');
    this.output.writeln();
    this.output.writeln('✔ SDKGenerator — siempre');
    this.output.writeln();

    const functionSkipReason = this.getFunctionGenerationSkipReason(adapter, generatorContext);

    if (functionSkipReason) {
      this.output.writeln(`⊘ FunctionGenerator — omitido (${functionSkipReason})`);
      this.output.writeln();
    } else {
      this.output.writeln('✔ FunctionGenerator — plataforma compatible');
      this.output.writeln();
    }

    this.output.writeln('Preparando configuración del workspace...');
    this.output.writeln();

    const workspaceConfig = await this.workspaceConfigGenerator.generate(generatorContext);

    this.output.writeln('✔ tsconfig.json');
    this.output.writeln();
    this.output.writeln(`✔ ${workspaceConfig.typesRelativePath}`);
    this.output.writeln();
    this.output.writeln('✔ package.json');
    this.output.writeln();

    if (!functionSkipReason) {
      await this.generateFunctions({
        adapter: adapter!,
        generatorContext,
        workspacePath,
        history,
      });

      this.output.writeln('Generando función funimas...');
      this.output.writeln();

      const funimasFunction = await this.funimasFunctionGenerator.generate(generatorContext);

      await this.generatedFileVerifier.verifyWrittenFile(
        workspacePath,
        {
          relativePath: funimasFunction.relativePath,
          absolutePath: funimasFunction.absolutePath,
          content: funimasFunction.content,
        },
        'FunimasFunctionGenerator',
      );

      await history.record({
        file: funimasFunction.absolutePath,
        operation: 'GENERATE_FUNCTION',
        rewriteRule: 'FunimasFunctionGenerator',
        before: '',
        after: funimasFunction.content,
        generatedFiles: [funimasFunction.relativePath],
        modifiedImports: [],
        status: 'COMPLETED',
        reason: 'La función funimas expone el runtime HTTP con Firebase Admin SDK.',
        benefit: 'El cliente deja de acceder a Firestore directamente.',
        riskLevel: 'LOW',
        generatedBy: 'FunimasFunctionGenerator',
        templateUsed: 'templates/netlify/funimas.hbs',
        compilerVersion: VERSION,
      });

      this.output.writeln('✔ funimas.ts');
      this.output.writeln();
    }

    this.output.writeln('Generando shared...');
    this.output.writeln();

    const sharedResult = await this.sharedGenerator.generate(
      new RuntimeContext({
        projectPath: this.projectPath,
        workspacePath,
        history,
      }),
    );

    await this.generatedFileVerifier.verifyPaths(
      workspacePath,
      sharedResult.generatedFiles.map((file) => file.relativePath),
      'SharedGenerator',
    );

    for (const generatedFile of sharedResult.generatedFiles) {
      this.output.writeln(`✔ ${generatedFile.fileName}`);
      this.output.writeln();
    }

    this.output.writeln('Generando Runtime...');
    this.output.writeln();

    const runtimeResult = await this.backendRuntimeGenerator.generate(
      new RuntimeContext({
        projectPath: this.projectPath,
        workspacePath,
        history,
      }),
    );

    await this.generatedFileVerifier.verifyPaths(
      workspacePath,
      runtimeResult.generatedFiles.map((file) => file.relativePath),
      'RuntimeGenerator',
    );

    for (const generatedFile of runtimeResult.generatedFiles) {
      this.output.writeln(`✔ ${generatedFile.fileName}`);
      this.output.writeln();
    }

    this.output.writeln('Generando SDK...');
    this.output.writeln();

    const sdkResult = await this.sdkGenerator.generate(generatorContext);

    await this.generatedFileVerifier.verifyWrittenFiles(
      workspacePath,
      sdkResult.files,
      'SDKGenerator',
    );

    this.output.writeln('✔ SDK');
    this.output.writeln();

    for (const generatedFile of sdkResult.files) {
      await history.record({
        file: generatedFile.absolutePath,
        operation: 'GENERATE_SDK',
        rewriteRule: 'SDKGenerator',
        before: '',
        after: generatedFile.content,
        generatedFiles: [generatedFile.relativePath],
        modifiedImports: [],
        status: 'COMPLETED',
        reason: 'El SDK centraliza el acceso a operaciones protegidas desde el cliente.',
        benefit: TransformationBenefit.forOperation('DATABASE_INSERT', 'addDoc'),
        riskLevel: 'LOW',
        generatedBy: 'SDKGenerator',
        templateUsed: 'src/generator/templates/sdk/index.ts',
        compilerVersion: VERSION,
      });
    }

    if (!adapterDetection.detected) {
      this.output.writeln('Nota: Runtime y SDK generados sin plataforma detectada.');
      this.output.writeln();
    }
  }

  private getFunctionGenerationSkipReason(
    adapter: PlatformAdapter | undefined,
    generatorContext: GeneratorContext,
  ): string | undefined {
    if (!adapter) {
      return 'plataforma no detectada';
    }

    if (!adapter.supports('functions')) {
      return `${adapter.name} no soporta functions`;
    }

    const plannerContext = new PlannerContext(generatorContext.semanticResult);
    const hasSupportedOperations = plannerContext
      .getTransformableOperations()
      .some((operation) => isSupportedFunctionOperation(operation.type));

    if (!hasSupportedOperations) {
      return 'sin operaciones compatibles para functions';
    }

    return undefined;
  }

  private async generateFunctions(options: {
    adapter: PlatformAdapter;
    generatorContext: GeneratorContext;
    workspacePath: string;
    history: TransformationHistory;
  }): Promise<void> {
    const { adapter, generatorContext, workspacePath, history } = options;

    this.output.writeln('Generando Functions...');
    this.output.writeln();

    const plannerContext = new PlannerContext(generatorContext.semanticResult);
    const processedOperationTypes = new Set<string>();

    for (const operation of plannerContext.getTransformableOperations()) {
      if (!isSupportedFunctionOperation(operation.type)) {
        continue;
      }

      if (processedOperationTypes.has(operation.type)) {
        continue;
      }

      processedOperationTypes.add(operation.type);

      const insertResult = await this.databaseInsertFunctionGenerator.generate(
        generatorContext,
        operation,
        adapter,
      );

      if (insertResult) {
        await this.generatedFileVerifier.verifyWrittenFile(
          workspacePath,
          insertResult.file,
          insertResult.metadata.generatedBy,
        );

        this.output.writeln(`✔ ${insertResult.file.fileName}`);
        this.output.writeln();

        await history.record({
          file: insertResult.file.absolutePath,
          operation: 'GENERATE_FUNCTION',
          rewriteRule: insertResult.metadata.generatedBy,
          before: '',
          after: insertResult.file.content,
          generatedFiles: insertResult.metadata.relatedGeneratedFiles,
          modifiedImports: [],
          status: 'COMPLETED',
          reason: insertResult.metadata.reason,
          benefit: insertResult.metadata.benefit,
          riskLevel: insertResult.metadata.riskLevel,
          generatedBy: insertResult.metadata.generatedBy,
          templateUsed: insertResult.metadata.templateUsed,
          compilerVersion: insertResult.metadata.compilerVersion,
        });

        continue;
      }

      const functionResult = await this.functionGenerator.generate(
        generatorContext,
        operation,
        adapter,
      );

      if (functionResult.functionFileNames.length > 0) {
        await this.generatedFileVerifier.verifyWrittenFiles(
          workspacePath,
          functionResult.files,
          'FunctionGenerator',
        );

        if (functionResult.files.length !== functionResult.functionFileNames.length) {
          const missing = functionResult.functionFileNames.filter(
            (fileName) => !functionResult.files.some((file) => file.fileName === fileName),
          );

          throw new GenerationVerificationError(
            'FunctionGenerator',
            missing[0] ?? 'unknown',
            join(workspacePath, missing[0] ?? 'unknown'),
            'archivo reportado sin escritura en disco',
          );
        }
      }

      for (const fileName of functionResult.functionFileNames) {
        this.output.writeln(`✔ ${fileName}`);
        this.output.writeln();

        const generatedFile = functionResult.files.find((file) => file.fileName === fileName);

        if (generatedFile) {
          const callee =
            typeof operation.metadata.callee === 'string' ? operation.metadata.callee : undefined;

          await history.record({
            file: generatedFile.absolutePath,
            operation: 'GENERATE_FUNCTION',
            rewriteRule: 'FunctionGenerator',
            before: '',
            after: generatedFile.content,
            generatedFiles: [generatedFile.relativePath],
            modifiedImports: [],
            status: 'COMPLETED',
            reason: TransformationReason.forOperation(operation.type, callee),
            benefit: TransformationBenefit.forOperation(operation.type, callee),
            riskLevel: 'LOW',
            generatedBy: 'FunctionGenerator',
            templateUsed: 'templates/netlify/databaseInsert.hbs',
            compilerVersion: VERSION,
          });
        }
      }
    }
  }

  private createGenerationFailureValidationResult(
    error: GenerationVerificationError,
    finishedAt: Date,
  ): ValidationResult {
    return new ValidationResult({
      valid: false,
      ruleResults: [],
      errors: [
        new ValidationError({
          ruleId: 'generation-verification',
          ruleName: 'Verificación de generación',
          message: error.message,
          files: [error.relativePath],
        }),
      ],
      failedTransformationIds: [],
      rolledBackTransformationIds: [],
      startedAt: finishedAt,
      finishedAt,
    });
  }

  private printRewriteSummary(rewriteResult: RewriteResult): void {
    for (const fileName of rewriteResult.modifiedFiles) {
      this.output.writeln(`✔ ${fileName}`);
      this.output.writeln();
    }

    this.output.writeln('Operaciones transformadas:');
    this.output.writeln();

    for (const [operationType, count] of Object.entries(rewriteResult.operationsRewritten)) {
      if (count > 0) {
        this.output.writeln(`${operationType}: ${count}`);
        this.output.writeln();
      }
    }
  }
}
