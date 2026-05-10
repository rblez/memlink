# Memlink Plan - Sistema de Memorias con Vinculación de Agentes

## Resumen Ejecutivo

Este plan describe la implementación de un sistema de creación de memorias universales con vinculación interactiva de agentes de IA (Windsurf, Cursor, OpenCode, Claude Code, Claude Desktop, GitHub Copilot).

**Meta**: Permitir que el usuario cree memorias y las vincule a múltiples agentes de forma interactiva, con scaffold automático de archivos de configuración MCP y skills.

---

## 1. Formato de Memorias

### Ubicación
- Archivos en `~/.memlink/*.memory.md`

### Formato (Estilo Libro)
```markdown
# Memoria: mi-proyecto

## Indice
1. ProjectContext - project, stack
2. UserPreferences - preferences

---

1. Building a SaaS app with Next.js 14 and Supabase.
2. The project is called "TaskFlow" and targets freelancers.
3. Stack: TypeScript, Next.js, Tailwind, Supabase, Stripe.

6. Prefers concise responses
7. Uses TypeScript strict mode always
```

### Reglas
- Índice primero, luego contenido
- Sin separadores `# INDEX` / `# END_INDEX`
- Números de línea como identificadores (1, 2, 3...)
- Separador `---` entre índice y contenido

### Migración Automática
- Detectar formato antiguo (`# INDEX` / `# END_INDEX`)
- Convertir automáticamente al nuevo formato al leer

---

## 2. Autenticación Multi-Agente

### Método de Autenticación
- **Query string**: `http://localhost:4444/mcp?mem_id=<memoryId>`
- Funciona para todos los agentes (incluyendo OpenCode que no soporta headers bearer)

### Servidor MCP
- Extraer `mem_id` de query string
- Validar contra `~/.memlink/config.json`
- El agente solo puede acceder a la memoria especificada

---

## 3. Flow de Creación de Memoria (Interactivo)

```bash
memlink memory create
```

Pasos:
1. **Nombre de memoria**: Input del usuario
2. **Descripción** (opcional): Input del usuario
3. **Alcance**: (g)lobal / (w)orkspace
4. **¿Crear skill?**: (y/n)
5. **Seleccionar agentes**: Barra espaciadora para marcar
   ```
   [x] Windsurf
   [x] OpenCode
   [ ] Cursor
   [ ] Claude Code
   [ ] Claude Desktop
   [ ] GitHub Copilot
   ```
6. **Scaffold**: Generar archivos automáticamente

---

## 4. Archivos a Generar por Agente

### Rutas por Agente

| Agente | MCP (Global) | MCP (Project) | Skill (Global) | Skill (Project) | Instructions |
|--------|--------------|---------------|----------------|------------------|--------------|
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | `.windsurf/mcp.json` | `~/.codeium/windsurf/skills/` | `.windsurf/skills/` | `AGENTS.md` |
| **Cursor** | `~/.cursor/mcp.json` | `.cursor/mcp.json` | - | - | - |
| **OpenCode** | `~/.config/opencode/opencode.json` | `./opencode.json` | `~/.config/opencode/skills/` | `.opencode/skills/` | `AGENTS.md` |
| **Claude Code** | `~/.claude.json` | `.mcp.json` | `~/.claude/skills/` | `.claude/skills/` | `AGENTS.md` |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` | - | - | - | - |
| **GitHub Copilot** | `~/.copilot/mcp-config.json` | `.vscode/mcp.json` | - | - | `AGENTS.md` |

### Formato MCP Config
```json
{
  "mcpServers": {
    "memlink": {
      "url": "http://localhost:4444/mcp?mem_id=<memoryId>"
    }
  }
}
```

### Formato Skill (SKILL.md)
```yaml
---
name: memlink-<nombre>
description: Acceso a memoria <nombre> de Memlink
---

# Memoria: <nombre>

Esta memoria contiene información de <descripción>

## Uso
El agente tiene acceso a herramientas MCP de Memlink:
- memory_read: Leer entradas
- memory_edit: Editar entradas
- memory_search: Buscar en la memoria

## Formato de la memoria
Las entradas están indexadas con números...
```

### AGENTS.md con @ referencia
```markdown
# Project Guidelines

## MCP Servers
Este proyecto usa Memlink para memoria persistente.
@memlink-<nombre>
```

---

## 5. Commands CLI Nuevos

### `memlink memory create`
- Flow interactivo de creación de memoria
- Ver sección 3

### `memlink memory detach <memory-id> [agent]`
- Desvincular agente(s) de una memoria
- Eliminar archivos MCP/skill generados

### `memlink memory list`
- Listar todas las memorias
- Mostrar agentes vinculados a cada memoria

### `memlink memory link <memory-id> <agent>`
- Vincular memoria existente a nuevo agente
- Generar archivos automáticamente

### `memlink memory unlink <memory-id> <agent>`
- Desvincular agente específico de memoria

---

## 6. Funcionalidades Adicionales

### Auto-check Servidor MCP
- Antes de operar, verificar si el servidor está corriendo
- Si no está,提示 al usuario para iniciarlo
- Comando: `memlink serve` o `memlink daemon`

### Ver Estado de Conexiones
- `memlink status` mostrar:
  - Estado del servidor MCP
  - Memorias existentes
  - Agentes con MCP configurado

---

## 7. Estilo y Convenciones

### Sin Emojis
- Usar solo símbolos ASCII y Unicode:
  - ✓ (checkmark)
  - ✗ (cross)
  - → (arrow)
  - • (bullet)
  - - (dash)

### Archivo de Configuración
- Ubicación: `~/.memlink/config.json`
- Estructura:
```json
{
  "universalMemories": [
    {
      "memoryId": "abc123",
      "memoryName": "mi-proyecto",
      "token": "memlink_xxxx",
      "memoryFile": "abc123.memory.md",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "linkedAgents": ["windsurf", "opencode"]
    }
  ],
  "lastHost": "localhost",
  "lastPort": 4444
}
```

---

## 8. Notas de Implementación

### Orden de Cambios Sugerido

1. **Servidor MCP** (`src/server/index.ts`)
   - Agregar soporte `mem_id` en query string
   - Mantener soporte header `Authorization: Bearer` como fallback

2. **Core Memory** (`src/core/memory.ts`)
   - Actualizar formato de escritura/lectura
   - Agregar migración automática
   - Agregar funciones para listar agentes vinculados

3. **CLI** (`src/cli/index.ts`)
   - Nuevo comando `memory create` interactivo
   - Nuevo comando `memory detach`
   - Nuevo comando `memory list`
   - Nuevo comando `memory link`
   - Nuevo comando `memory unlink`

4. **Scaffolding**
   - Funciones para generar archivos por agente
   - Templates para skills y AGENTS.md

---

## 9. Preguntas Pendientes

- ¿Guardar último host:puerto en config? (opcional)
- ¿Soporte para múltiples memorias por agente? (sí, cada una con su URL)

---

## 10. Referencias

- Documentación de MCP por agente: ver búsquedas web en esta sesión
- Formato SKILL.md: estándar Agent Skills de Anthropic
- AGENTS.md: estándar abierto reconocido por Windsurf, OpenCode, Claude Code, GitHub Copilot

---

## 11. Workflow de Desarrollo

### Ramas
- `main` - Rama estable, solo se fusiona via PR
- `beta` - Rama de desarrollo activo
- `feature/*` - Ramas para nuevas funcionalidades

### Proceso de Trabajo

1. **Crear Issue**: Describir el problema o feature en GitHub Issues
2. **Crear Rama**: Desde `beta`, crear rama `feature/nombre`
3. **Desarrollar**: Trabajar en la rama feature
4. **Crear PR**: PR de `feature/*` hacia `beta`
5. **Code Review**: Reviewer approves y mergea
6. **Fusionar a Main**: PR de `beta` hacia `main` para release

### Commits
- Usar mensajes descriptivos: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Ejemplo: `fix: handle missing Content-Length in install.sh`

### Workflow en GitHub Actions
- Push a `beta` activa el workflow de test
- Push de tag `v*` activa workflow de release
- Solo `main` genera releases