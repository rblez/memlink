#!/usr/bin/env bun
// Memlink CLI executable - TypeScript version
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic import of the CLI
await import(join(__dirname, '../src/cli/index.ts')).catch(() => {
  console.error('Error: Failed to load CLI from src/cli/index.ts');
  process.exit(1);
});
