# Bin Directory

Binary executables for the Memlink CLI.

## Files

### [memlink.ts](./memlink.ts)

CLI entry point executable. This is the main TypeScript binary that users run to interact with Memlink.

**Purpose:**
- Bootstrap the CLI application
- Import and execute the TypeScript CLI code
- Handle Bun execution environment

**Content:**
```typescript
#!/usr/bin/env bun
import("../src/cli/index.ts");
```

**How it works:**
1. Shebang (`#!/usr/bin/env bun`) makes the file executable
2. Imports the TypeScript directly from `../src/cli/index.ts`
3. CLI takes over and processes user commands

## Usage

```bash
# Direct execution
./bin/memlink.ts --help

# Via Bun (after bun install -g .)
memlink --help

# With Bun explicitly
bun bin/memlink.ts --help
```

## Installation

**Global installation:**
```bash
# Install globally
bun install -g .

# Now available as 'memlink' command
memlink --help
memlink agent list
memlink serve
```

**Local development:**
```bash
# Build first (optional)
bun run build

# Run locally
memlink --help
```

## Bun Configuration

The binary is registered in `package.json`:

```json
{
  "name": "memlink",
  "bin": {
    "memlink": "./bin/memlink.ts"
  }
}
```

This makes the CLI available as a global command when installed with `bun install -g .`

## Requirements

- Bun (JavaScript runtime)
- TypeScript source code in `../src/` directory
- Dependencies installed in `../node_modules/`

## Build Process

The binary can run TypeScript directly or use compiled code:

```bash
# 1. Compile TypeScript (optional)
bun run build

# 2. Binary is executable (TypeScript or compiled)
memlink --help
```

**Build output:**
```
dist/
├── cli/
│   └── index.js    # Compiled CLI code
├── core/
│   ├── memory.js
│   └── types.js
└── server/
    └── index.js
```

## Development

**During development, you can run TypeScript directly:**
```bash
# Using Bun (TypeScript executor)
bun src/cli/index.ts --help

# Or use the binary
memlink --help
```

**For production:**
```bash
# Always use the binary
memlink --help
```

## Debugging

```bash
# Enable Bun debug mode
bun --inspect bin/memlink.ts --help

# Check Bun version
bun --version

# Verbose output
memlink -v --help
```

## File Permissions

The file must be executable:

```bash
# Check permissions
ls -la bin/memlink.ts

# Make executable (if needed)
chmod +x bin/memlink.ts
```

## Distribution

When publishing to npm:

1. Build is included in npm package
2. Binary is automatically linked when installed globally
3. Users can run `memlink` command directly

**npm package structure:**
```
memlink/
├── bin/
│   └── memlink.ts      # CLI TypeScript binary
├── dist/               # compiled code (optional)
├── package.json
└── README.md
```
