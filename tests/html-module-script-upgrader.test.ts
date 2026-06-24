import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { HtmlModuleScriptUpgrader } from '../src/parser/HtmlModuleScriptUpgrader.js';

describe('HtmlModuleScriptUpgrader', () => {
  it('promueve script src a type="module" cuando el archivo usa import', async () => {
    const workspacePath = join(tmpdir(), `funimas-html-module-${Date.now()}`);
    await mkdir(join(workspacePath, 'assets', 'js'), { recursive: true });
    await writeFile(
      join(workspacePath, 'assets', 'js', 'app.js'),
      `import { Funimas } from "../../sdk/index.js";\nconsole.log(Funimas);\n`,
      'utf8',
    );
    await writeFile(
      join(workspacePath, 'index.html'),
      `<!doctype html>
<html>
  <body>
    <script src="assets/js/app.js?v=1"></script>
  </body>
</html>
`,
      'utf8',
    );

    const modified = await new HtmlModuleScriptUpgrader().upgrade(workspacePath);
    const html = await readFile(join(workspacePath, 'index.html'), 'utf8');

    expect(modified).toHaveLength(1);
    expect(html).toContain('<script src="assets/js/app.js?v=1" type="module"></script>');
  });

  it('no modifica scripts que ya son módulos o no usan ESM', async () => {
    const workspacePath = join(tmpdir(), `funimas-html-plain-${Date.now()}`);
    await mkdir(join(workspacePath, 'assets', 'js'), { recursive: true });
    await writeFile(join(workspacePath, 'assets', 'js', 'plain.js'), `console.log('ok');\n`, 'utf8');
    await writeFile(
      join(workspacePath, 'index.html'),
      `<script type="module" src="assets/js/plain.js"></script>\n<script src="assets/js/plain.js"></script>\n`,
      'utf8',
    );

    const modified = await new HtmlModuleScriptUpgrader().upgrade(workspacePath);
    const html = await readFile(join(workspacePath, 'index.html'), 'utf8');

    expect(modified).toHaveLength(0);
    expect(html).toContain('<script type="module" src="assets/js/plain.js"></script>');
    expect(html).toContain('<script src="assets/js/plain.js"></script>');
  });
});
