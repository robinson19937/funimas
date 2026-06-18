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
  RuntimeGenerator,
  SDKGenerator,
  type FunctionGeneratorService,
  type RuntimeGeneratorService,
  type SDKGeneratorService,
} from '../../generator/index.js';
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
  runtimeGenerator?: RuntimeGeneratorService;
  sdkGenerator?: SDKGeneratorService;
  functionGenerator?: FunctionGeneratorService;
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
  private readonly runtimeGenerator: RuntimeGeneratorService;
  private readonly sdkGenerator: SDKGeneratorService;
  private readonly functionGenerator: FunctionGeneratorService;

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
    this.runtimeGenerator = options.runtimeGenerator ?? new RuntimeGenerator();
    this.sdkGenerator = options.sdkGenerator ?? new SDKGenerator();
    this.functionGenerator = options.functionGenerator ?? new FunctionGenerator();
  }

  async execute(): Promise<PlannerResult> {
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

    if (adapterDetection.adapter) {
      const generatorContext = new GeneratorContext({
        projectPath: this.projectPath,
        workspacePath: workspaceResult.workspaceProject,
        semanticResult,
        adapter: adapterDetection.adapter,
      });

      this.output.writeln('Generando Runtime...');
      this.output.writeln();
      await this.runtimeGenerator.generate(generatorContext);
      this.output.writeln('✔ Runtime');
      this.output.writeln();

      this.output.writeln('Generando SDK...');
      this.output.writeln();
      await this.sdkGenerator.generate(generatorContext);
      this.output.writeln('✔ SDK');
      this.output.writeln();

      this.output.writeln('Generando Functions...');
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

        const functionResult = await this.functionGenerator.generate(
          generatorContext,
          operation,
          adapterDetection.adapter,
        );

        for (const fileName of functionResult.functionFileNames) {
          this.output.writeln(`✔ ${fileName}`);
          this.output.writeln();
        }
      }
    }

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
}
