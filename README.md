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
3. **AST Parser** para cargar el proyecto con ts-morph
4. **Project Scanner** para construir el índice interno del proyecto
5. **Dependency Graph** para mapear relaciones entre archivos
6. **Semantic Analyzer** para detectar operaciones semánticas mediante reglas extensibles

```
Funimas

✔ Backup creado

✔ Workspace creado

Proyecto original:

/ruta/absoluta/del/proyecto

Proyecto de trabajo:

/ruta/absoluta/del/proyecto_funimas

Analizando estructura...

✔ 58 archivos

✔ 241 imports

✔ 86 funciones

✔ 12 clases

✔ 7 interfaces

✔ 2 enums

Construyendo Dependency Graph...

✔ Nodos: 58

✔ Relaciones: 214

✔ Componentes: 1

Análisis semántico

✔ Firebase detectado

✔ Firestore
Insert: 6
Update: 2
Delete: 1
Read: 8

✔ Authentication
Login: 2
Register: 1

✔ Storage
Upload: 3
```

Tanto el backup como el workspace excluyen automáticamente: `node_modules`, `.git`, `.funimas`, `dist` y `coverage`. El análisis semántico utiliza un motor de reglas extensible sin modificar archivos del proyecto.

## Estructura del proyecto

```
src/
  cli/         Punto de entrada y comandos de la CLI
  compiler/    Lógica de compilación (futuro)
  parser/      Carga y modelo AST del proyecto (AstParser / ts-morph)
  scanner/     Índice interno del proyecto (ProjectScanner)
  graph/       Grafo de dependencias del proyecto (DependencyGraph)
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
