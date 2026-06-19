import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Handlebars from 'handlebars';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

Handlebars.registerHelper('json', (value: unknown) => JSON.stringify(value));
Handlebars.registerHelper('toLowerCase', (value: string) => String(value).toLowerCase());
Handlebars.registerHelper('escapeHtml', (value: string) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;'),
);
Handlebars.registerHelper('hasItems', (value: unknown) => Array.isArray(value) && value.length > 0);

/**
 * Motor de plantillas Handlebars para runtime y reportes.
 */
export class RuntimeTemplateEngine {
  private readonly templatesRoot: string;
  private readonly cache = new Map<string, Handlebars.TemplateDelegate>();

  constructor(templatesRoot: string = join(packageRoot, 'templates')) {
    this.templatesRoot = templatesRoot;
  }

  async render(templateRelativePath: string, data: Record<string, unknown> = {}): Promise<string> {
    const template = await this.getTemplate(templateRelativePath);

    return template(data).trim();
  }

  private async getTemplate(templateRelativePath: string): Promise<Handlebars.TemplateDelegate> {
    const cached = this.cache.get(templateRelativePath);

    if (cached) {
      return cached;
    }

    const { readFile } = await import('node:fs/promises');
    const templatePath = join(this.templatesRoot, templateRelativePath);
    const source = await readFile(templatePath, 'utf8');
    const compiled = Handlebars.compile(source, {
      noEscape:
        templateRelativePath.endsWith('.json.hbs') ||
        templateRelativePath.endsWith('.md.hbs') ||
        templateRelativePath.endsWith('.html.hbs'),
    });

    this.cache.set(templateRelativePath, compiled);

    return compiled;
  }
}
