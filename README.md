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
3. **AST Parser** para cargar y modelar todos los archivos TypeScript/JavaScript del workspace

```
Funimas

✔ Backup creado

✔ Workspace creado

Proyecto original:

/ruta/absoluta/del/proyecto

Proyecto de trabajo:

/ruta/absoluta/del/proyecto_funimas

Analizando proyecto...

✔ Proyecto cargado

Archivos encontrados: 42

TypeScript: 30

JavaScript: 12
```

Tanto el backup como el workspace excluyen automáticamente: `node_modules`, `.git`, `.funimas`, `dist` y `coverage`. El parser utiliza **ts-morph** y aplica las mismas exclusiones.

## Estructura del proyecto

```
src/
  cli/         Punto de entrada y comandos de la CLI
  compiler/    Lógica de compilación (futuro)
  parser/      Carga y modelo AST del proyecto (AstParser / ts-morph)
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
