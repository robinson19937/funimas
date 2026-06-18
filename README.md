# Funimas

Herramienta de línea de comandos que protege tu proyecto de software. Analiza el código, crea una copia de trabajo segura y aplica cambios **sin tocar los archivos originales**.

## ¿Qué necesitas antes de empezar?

1. **Node.js** versión 20 o superior.  
   Puedes comprobarlo abriendo una terminal y escribiendo:

   ```bash
   node --version
   ```

2. **Git** instalado en tu computadora.

3. Una **terminal** (en Windows: PowerShell o CMD; en Mac/Linux: Terminal).

## Instalación (solo la primera vez)

Copia y pega estos comandos **uno por uno** en la terminal. Espera a que cada uno termine antes de ejecutar el siguiente.

```bash
git clone https://github.com/robinson19937/funimas.git
```

Descarga el proyecto Funimas en tu computadora.

```bash
cd funimas
```

Entra en la carpeta del proyecto.

```bash
npm install
```

Instala las dependencias necesarias.

```bash
npm run build
```

Prepara Funimas para poder usarlo.

```bash
npm link
```

Registra el comando `funimas` en tu sistema. A partir de aquí podrás escribir `funimas` desde cualquier carpeta.

> **Si `npm link` da error de permisos**, puedes usar Funimas sin registrarlo:
>
> ```bash
> node dist/cli/index.js protect ./ruta-de-tu-proyecto
> ```

## Cómo usar Funimas

### Paso 1: Proteger un proyecto

En la terminal, ve a la carpeta donde está tu proyecto (o usa la ruta completa) y ejecuta:

```bash
funimas protect ./ruta-de-tu-proyecto
```

**Ejemplo con el proyecto de demostración incluido:**

```bash
funimas protect ./examples/react-firebase-crud
```

### Paso 2: Qué hace Funimas

1. Crea una **copia de seguridad** de tu proyecto.
2. Genera una **copia de trabajo** en una carpeta nueva llamada `<tu-proyecto>_funimas`.
3. Analiza el código y aplica las protecciones necesarias.
4. Genera informes con los cambios realizados.

**Tu proyecto original no se modifica.** Todo ocurre en la carpeta nueva.

### Paso 3: Dónde ver los resultados

| Qué buscas | Dónde está |
| ---------- | ---------- |
| Proyecto protegido (copia de trabajo) | `<tu-proyecto>_funimas/` |
| Copia de seguridad | `.funimas/backups/` (dentro del proyecto original) |
| Informes de cambios | `.funimas/reports/` (dentro del proyecto original) |

### Requisitos del proyecto a proteger (versión actual)

- Debe ser un proyecto con código TypeScript o JavaScript.
- Debe tener un archivo `netlify.toml` en la raíz.
- Debe usar llamadas `addDoc()` de Firestore (es lo que Funimas protege hoy).

## Scripts de desarrollo

| Script  | Descripción                                      |
| ------- | ------------------------------------------------ |
| `dev`   | Ejecuta la CLI en modo desarrollo con recarga    |
| `build` | Compila TypeScript a JavaScript en `dist/`       |
| `start` | Ejecuta la versión compilada                     |
| `test`  | Ejecuta las pruebas unitarias con Vitest         |
| `lint`  | Analiza el código con ESLint                     |

## Comandos disponibles

### `protect <ruta-del-proyecto>`

Inicializa la protección de un proyecto siguiendo este flujo:

1. **Backup** del proyecto original en `.funimas/backups/`
2. **Workspace** de trabajo en `<proyecto>_funimas` (única copia que Funimas modificará)
3. **AST Parser** para cargar el proyecto con ts-morph
4. **Project Scanner** para construir el índice interno del proyecto
5. **Dependency Graph** para mapear relaciones entre archivos
6. **Semantic Analyzer** para detectar operaciones semánticas mediante reglas extensibles
7. **Transformation Planner** para generar el plan de ejecución
8. **Code Rewriter** para aplicar los cambios en el workspace
9. **Validation** y generación de **informes**

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

Planificando transformación...

✔ Acciones: 18

✔ Runtime: 1

✔ SDK: 1

✔ Functions: 6

✔ Rewrites: 12

✔ Imports: 12

✔ Validaciones: 1
```

## Estructura del proyecto

```
src/
  cli/         Punto de entrada y comandos de la CLI
  pipeline/    Orquestador principal del flujo de protección
  parser/      Carga y modelo AST del proyecto (AstParser / ts-morph)
  scanner/     Índice interno del proyecto (ProjectScanner)
  graph/       Grafo de dependencias del proyecto (DependencyGraph)
  semantic/    Análisis semántico basado en reglas (SemanticAnalyzer)
  planner/     Planificación de transformaciones
  generator/   Generación de código (functions, SDK, runtime)
  rewriter/    Aplicación de cambios en el código
  validation/  Motor de validación post-transformación
  rollback/    Reversión parcial de cambios
  backup/      Motor de copias de seguridad (BackupEngine)
  workspace/   Copia de trabajo del proyecto (WorkspaceEngine)
  report/      Generación de informes
  history/     Historial de transformaciones
  utils/       Utilidades compartidas
tests/         Pruebas unitarias
templates/     Plantillas Handlebars
examples/      Proyectos de ejemplo
```

## Licencia

MIT
