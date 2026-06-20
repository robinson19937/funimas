# Regresión de `funimas protect`

Esta suite ejecuta el pipeline completo sobre fixtures representativos y valida que el workspace generado sea coherente con las expectativas de cada caso.

## Fixtures incluidos

| ID | Origen | Qué valida |
|----|--------|------------|
| `react-firebase-crud` | `examples/react-firebase-crud` | CRUD React básico |
| `multi-company-onboarding` | fixture local | Alta multiempresa, `upsertDocumentAtPath`, `listWhere` |
| `pwa-html-queries` | fixture local | Scripts inline en HTML + consultas `where` |
| `unsupported-transaction` | fixture local | `runTransaction` con lecturas dependientes → `Funimas.domain.execute` |
| `unsupported-batch` | fixture local | `writeBatch` → `Funimas.domain.execute` atómico |

## Ejecutar

```bash
npx vitest run tests/regression/protect-regression.test.ts
```

## Añadir un repo real

1. Copia un subconjunto mínimo del repo a `tests/regression/fixtures/<nombre>/`.
2. Añade una entrada en `REGRESSION_FIXTURES` dentro de `helpers/run-protect-fixture.ts`.
3. Define expectativas: `success`, archivos generados, snippets en código reescrito, `operationsUntransformed`.

Mantén los fixtures pequeños: solo los archivos necesarios para reproducir el patrón que quieres proteger.
