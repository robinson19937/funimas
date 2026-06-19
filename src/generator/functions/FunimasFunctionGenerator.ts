import { join } from 'node:path';

import type { GeneratedFile } from '../../adapters/GeneratedFile.js';
import { GeneratorFileWriter } from '../GeneratorFileWriter.js';
import type { GeneratorContext } from '../GeneratorContext.js';
import { RuntimeTemplateEngine } from '../../runtime/RuntimeTemplateEngine.js';

const TEMPLATE_PATH = 'netlify/funimas.hbs';
const NETLIFY_FUNCTIONS_DIR = 'netlify/functions';

export interface FunimasFunctionGeneratorOptions {
  templateEngine?: RuntimeTemplateEngine;
  fileWriter?: GeneratorFileWriter;
}

export interface FunimasFunctionGeneratorService {
  generate(context: GeneratorContext): Promise<GeneratedFile & { absolutePath: string }>;
}

/**
 * Genera la Netlify Function principal que expone el runtime HTTP (/api/clubs/*).
 */
export class FunimasFunctionGenerator implements FunimasFunctionGeneratorService {
  private readonly templateEngine: RuntimeTemplateEngine;
  private readonly fileWriter: GeneratorFileWriter;

  constructor(options: FunimasFunctionGeneratorOptions = {}) {
    this.templateEngine = options.templateEngine ?? new RuntimeTemplateEngine();
    this.fileWriter =
      options.fileWriter ?? new GeneratorFileWriter({ generatorName: 'FunimasFunctionGenerator' });
  }

  async generate(context: GeneratorContext): Promise<GeneratedFile & { absolutePath: string }> {
    const fileName = 'funimas.ts';
    const relativePath = join(NETLIFY_FUNCTIONS_DIR, fileName);
    const content = await this.templateEngine.render(TEMPLATE_PATH);

    return this.fileWriter.writeFile(context.workspacePath, {
      fileName,
      relativePath,
      content,
    });
  }
}
