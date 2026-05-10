#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  await import(join(__dirname, "../dist/cli/index.js"));
} catch (err) {
  console.error("Error: Failed to load CLI from dist/cli/index.js");
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
}
