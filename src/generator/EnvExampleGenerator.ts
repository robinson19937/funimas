import { RuntimeTemplateEngine } from '../runtime/RuntimeTemplateEngine.js';
import type { GeneratedFile } from '../adapters/GeneratedFile.js';
import type { GeneratorContext } from './GeneratorContext.js';
import { GeneratorFileWriter } from './GeneratorFileWriter.js';

const ENV_EXAMPLE_TEMPLATE = 'deploy/env.example.hbs';

export interface EnvExampleResult {
  file: GeneratedFile;
}

/**
 * Genera .env.example con las variables requeridas para cliente y servidor.
 */
export class EnvExampleGenerator {
  private readonly fileWriter: GeneratorFileWriter;
  private readonly templateEngine: RuntimeTemplateEngine;

  constructor(
    fileWriter: GeneratorFileWriter = new GeneratorFileWriter({ generatorName: 'EnvExampleGenerator' }),
    templateEngine: RuntimeTemplateEngine = new RuntimeTemplateEngine(),
  ) {
    this.fileWriter = fileWriter;
    this.templateEngine = templateEngine;
  }

  async generate(context: GeneratorContext): Promise<EnvExampleResult> {
    const content = await this.templateEngine.render(ENV_EXAMPLE_TEMPLATE, {});

    const file: GeneratedFile = {
      fileName: '.env.example',
      relativePath: '.env.example',
      content: `${content.trimEnd()}\n`,
    };

    await this.fileWriter.writeFile(context.workspacePath, file);

    return { file };
  }
}
