import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import {
  ADAPTER_FEATURE_LABELS,
  AdapterContext,
  createDefaultAdapterRegistry,
  type AdapterFeature,
  type AdapterRegistryDetectionResult,
  type AdapterRegistryService,
} from '../../adapters/index.js';
import { BackupEngine, type BackupService } from '../../backup/index.js';
import { GraphBuilder, type GraphBuilderService } from '../../graph/index.js';
import type { GraphResult } from '../../graph/GraphResult.js';
import {
  FunctionGenerator,
  GeneratorContext,
  SDKGenerator,
  type FunctionGeneratorService,
  type SDKGeneratorService,
} from '../../generator/index.js';
import { DatabaseInsertFunctionGenerator } from '../../generator/functions/DatabaseInsertFunctionGenerator.js';
import { TransformationHistory } from '../../history/index.js';
import { ChangeReportGenerator } from '../../report/index.js';
import { TransformationBenefit } from '../../report/TransformationBenefit.js';
import { TransformationReason } from '../../report/TransformationReason.js';
import { RuntimeGenerator, RuntimeContext, type RuntimeGeneratorService } from '../../runtime/index.js';
import { CodeRewriter, RewriteContext, type CodeRewriterService } from '../../rewriter/index.js';
import type { RewriteResult } from '../../rewriter/RewriteResult.js';
import { TransformationPlanner, type TransformationPlannerService } from '../../planner/index.js';
import { PlannerContext } from '../../planner/PlannerContext.js';
import { isSupportedFunctionOperation } from '../../generator/operation-utils.js';
import type { PlannerResult } from '../../planner/PlannerResult.js';
import { AstParser, type AstParserService } from '../../parser/index.js';
import { ProjectScanner, type ProjectScannerService } from '../../scanner/index.js';
import type { ScanResult } from '../../scanner/ScanResult.js';
import { SemanticAnalyzer, type SemanticAnalyzerService } from '../../semantic/index.js';
import type { SemanticResult } from '../../semantic/SemanticResult.js';
import { SemanticOperation } from '../../semantic/SemanticOperation.js';
import { ConsoleOutputWriter, NullOutputWriter, type OutputWriter } from '../../utils/index.js';
import { VERSION } from '../../utils/version.js';
import { WorkspaceEngine, type WorkspaceService } from '../../workspace/index.js';
import type { WorkspaceResult } from '../../workspace/WorkspaceResult.js';

export interface ProtectCommandOptions {
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
  databaseInsertFunctionGenerator?: DatabaseInsertFunctionGenerator;
}

export class ProtectCommand {
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
  private readonly databaseInsertFunctionGenerator: DatabaseInsertFunctionGenerator;
  private readonly executionId: string;

  constructor(options: ProtectCommandOptions) {
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
    this.databaseInsertFunctionGenerator =
      options.databaseInsertFunctionGenerator ?? new DatabaseInsertFunctionGenerator();
    this.executionId = randomUUID();
  }

  async execute(): Promise<PlannerResult> {
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

    if (adapterDetection.adapter) {
      const generatorContext = new GeneratorContext({
        projectPath: this.projectPath,
        workspacePath: workspaceResult.workspaceProject,
        semanticResult,
        adapter: adapterDetection.adapter,
      });

      this.output.writeln('Generando SDK...');
      this.output.writeln();
      const sdkResult = await this.sdkGenerator.generate(generatorContext);
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

      this.output.writeln('Generando Netlify Function...');
      this.output.writeln();

      const plannerContext = new PlannerContext(semanticResult);
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
          adapterDetection.adapter,
        );

        if (insertResult) {
          this.output.writeln(`✔ ${insertResult.file.fileName}`);
          this.output.writeln();

          this.output.writeln('Registrando transformación...');
          this.output.writeln();
          this.output.writeln('✔ Reason registrada');
          this.output.writeln();
          this.output.writeln('✔ Benefit registrado');
          this.output.writeln();
          this.output.writeln(`✔ Risk Level: ${insertResult.metadata.riskLevel}`);
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
          adapterDetection.adapter,
        );

        for (const fileName of functionResult.functionFileNames) {
          this.output.writeln(`✔ ${fileName}`);
          this.output.writeln();

          if (functionResult.files.length > 0) {
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

      this.output.writeln('Generando Runtime...');
      this.output.writeln();

      const runtimeResult = await this.backendRuntimeGenerator.generate(
        new RuntimeContext({
          projectPath: this.projectPath,
          workspacePath: workspaceResult.workspaceProject,
          history,
        }),
      );

      for (const generatedFile of runtimeResult.generatedFiles) {
        this.output.writeln(`✔ ${generatedFile.fileName}`);
        this.output.writeln();
      }
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

    this.output.writeln('Actualizando reporte...');
    this.output.writeln();

    const pipelineFinishedAt = new Date();
    const reportResult = await this.changeReportGenerator.generate(
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

    void reportResult;

    return plannerResult;
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
    if (!detection.adapter) {
      this.output.writeln('✔ Plataforma no detectada');
      this.output.writeln();
      return;
    }

    this.output.writeln(`✔ ${detection.adapter.name}`);
    this.output.writeln();
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
