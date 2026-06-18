# Funimas

CLI profesional en TypeScript para proteger y gestionar proyectos de software.

## Requisitos

- Node.js >= 20

## Instalación

```bash
npm install
```

## Scripts

| Script  | Descripción                                      |
| ------- | ------------------------------------------------ |
| `dev`   | Ejecuta la CLI en modo desarrollo con recarga    |
| `build` | Compila TypeScript a JavaScript en `dist/`       |
| `start` | Ejecuta la versión compilada                     |
| `test`  | Ejecuta las pruebas unitarias con Vitest         |
| `lint`  | Analiza el código con ESLint                     |

## Uso

```bash
# Desarrollo
npm run dev -- protect ./mi-proyecto

# Producción
npm run build
npm start -- protect ./mi-proyecto
```

### Comandos disponibles

#### `protect <ruta-del-proyecto>`

Inicializa la protección de un proyecto siguiendo este flujo:

1. **Backup** del proyecto original en `.funimas/backups/`
2. **Workspace** de trabajo en `<proyecto>_funimas` (única copia que Funimas modificará)

```
Funimas

✔ Backup creado

✔ Workspace creado

Proyecto original:

/ruta/absoluta/del/proyecto

Proyecto de trabajo:

/ruta/absoluta/del/proyecto_funimas
```

Tanto el backup como el workspace excluyen automáticamente: `node_modules`, `.git`, `.funimas`, `dist` y `coverage`.

## Estructura del proyecto

```
src/
  cli/         Punto de entrada y comandos de la CLI
  compiler/    Lógica de compilación (futuro)
  parser/      Análisis sintáctico (futuro)
  analyzer/    Análisis semántico (futuro)
  planner/     Planificación (futuro)
  generator/   Generación de código (futuro)
  backup/      Motor de copias de seguridad (BackupEngine)
  workspace/   Copia de trabajo del proyecto (WorkspaceEngine)
  report/      Informes (futuro)
  utils/       Utilidades compartidas
tests/         Pruebas unitarias
templates/     Plantillas (futuro)
```

## Licencia

MIT
