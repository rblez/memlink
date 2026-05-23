# Skill Installation

The Memlink skill teaches AI agents how to use Memlink's MCP tools effectively.

## Installation

### Workspace (current project)

```bash
memlink skill
```

Installs the skill to `.agents/skills/memlink/SKILL.md` in the current directory.

### Global (all projects)

```bash
memlink skill --global
# or
memlink skill -g
```

Installs the skill to `~/.agents/skills/memlink/SKILL.md` for all projects.

## What the skill contains

The skill instructs the agent to:

1. **Read memory at session start** — Always call `memory_read` to load existing context
2. **Save during session** — Use `memory_edit` whenever the user says "save", "remember", "store"
3. **Search before create** — Use `memory_search` to check for duplicates
4. **Follow best practices** — PascalCase titles, categorical tags, focused entries
5. **Validate at end** — Optionally call `memory_sync` to verify integrity

## Supported agents

The skill format is compatible with OpenCode and any agent that reads `.agents/` skills.
