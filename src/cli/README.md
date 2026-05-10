# CLI Directory

Command-line interface implementation for Memlink.

## Files

### [index.ts](./index.ts)

Main CLI entry point. Contains all command definitions and user-facing functionality.

**Purpose:**
- Defines all CLI commands using Commander.js
- Handles user input and output formatting
- Provides interactive prompts for configuration
- Manages global options (--json, --verbose)

**Key Components:**

#### Global Options
- `--json` - Output in JSON format for scripting
- `-v, --verbose` - Show detailed debugging output

#### Commands

**Server Management:**
- `memlink serve` - Start the MCP server
- `memlink status` - Show system status

**Agent Management:**
- `memlink agent create <type>` - Create a new agent
- `memlink agent list` - List all agents
- `memlink agent token <agentId>` - Show agent token
- `memlink agent revoke <agentId>` - Revoke agent
- `memlink agent rotate <agentId>` - Rotate agent token

**Memory Operations:**
- `memlink memory list` - List all memory files
- `memlink memory show <agentId>` - Show agent memory
- `memlink memory search <agentId> <query>` - Search memory
- `memlink memory export <agentId>` - Export memory to JSON
- `memlink memory import <agentId> <file>` - Import memory from JSON
- `memlink memory stats <agentId>` - Show memory statistics

**Skill Management:**
- `memlink skill install <agentType>` - Install skill for agent type
- `memlink skill update <agentType>` - Update skill for agent type

**Configuration:**
- `memlink config` - View/modify configuration
- `memlink init` - Initialize Memlink

**Utility Functions:**
- `outputJson(data)` - Format output as JSON
- `verboseLog(...args)` - Log only in verbose mode
- `promptSkillLocation(agentType)` - Interactive skill location prompt
- `writeSkillScaffold(location, agentType)` - Write skill file to `.agents/skills/memlink/SKILL.md`

**Color Palette:**
Uses a pure color palette defined in `c` object:
- `c.text` - White text
- `c.bold` - Bold white text
- `c.dim` - Dimmed text
- `c.success` - Green for success messages
- `c.error` - Red for error messages
- `c.warning` - Yellow for warnings
- `c.info` - Blue for info messages

**Dependencies:**
- `commander` - CLI framework
- `chalk` - Terminal colors
- `ora` - Loading spinners
- `table` - Table formatting

## Usage

```bash
# Build
npm run build

# Run CLI
node bin/memlink.js --help
node bin/memlink.js agent list
node bin/memlink.js --json memory list
```

## Development

```bash
# Run in dev mode
npx tsx src/cli/index.ts --help
```

## Output Formats

The CLI supports two output formats:

**Normal (human-readable):**
```
  Memlink v1.0.0

  Agent        ID           Token          Memory
  Windsurf     abc123...    memlink_abc... abc123.memory
```

**JSON (for scripting):**
```json
[
  {
    "name": "Windsurf",
    "id": "abc123",
    "memoryFile": "abc123.memory"
  }
]
```

## Error Handling

All commands include proper error handling:
- Try-catch blocks for operations
- User-friendly error messages
- Exit code 1 on errors
- JSON error output when `--json` flag is used
