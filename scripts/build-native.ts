#!/usr/bin/env bun
/**
 * Build native standalone binaries for all platforms.
 *
 * Uses bun build --compile to create platform-specific executables.
 * These binaries do NOT require Node.js, Bun, or any runtime.
 *
 * Usage:
 *   bun run scripts/build-native.ts
 *   bun run scripts/build-native.ts --platform linux-x64   # single platform
 *   bun run scripts/build-native.ts --list                  # list platforms
 */

import { $ } from 'bun';
import path from 'path';

const PLATFORMS = [
  { os: 'linux', arch: 'x64', target: 'bun-linux-x64' },
  { os: 'linux', arch: 'arm64', target: 'bun-linux-arm64' },
  { os: 'darwin', arch: 'x64', target: 'bun-darwin-x64' },
  { os: 'darwin', arch: 'arm64', target: 'bun-darwin-arm64' },
  { os: 'windows', arch: 'x64', target: 'bun-windows-x64' },
];

const distDir = path.join(process.cwd(), 'dist', 'binaries');
const entryPoint = path.join(process.cwd(), 'src', 'cli', 'index.ts');

function getBinaryName(os: string, arch: string): string {
  return os === 'windows' ? `memlink-${os}-${arch}.exe` : `memlink-${os}-${arch}`;
}

async function buildPlatform(os: string, arch: string, target: string): Promise<void> {
  const outputName = getBinaryName(os, arch);
  const outputPath = path.join(distDir, outputName);

  console.log(`Building ${os}-${arch}...`);

  try {
    await $`bun build --compile --target ${target} --outfile ${outputPath} ${entryPoint}`;
    console.log(`  ✓ ${outputName}`);
  } catch (error) {
    console.error(`  ✗ Failed for ${target}:`, error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    console.log('Available platforms:');
    for (const p of PLATFORMS) {
      console.log(`  ${p.os}-${p.arch}  (${p.target})`);
    }
    return;
  }

  const filterPlatform = args.find((a) => a.startsWith('--platform='));
  const platforms = filterPlatform
    ? PLATFORMS.filter((p) => `${p.os}-${p.arch}` === filterPlatform.split('=')[1])
    : PLATFORMS;

  if (platforms.length === 0) {
    console.error(`Platform not found: ${filterPlatform?.split('=')[1]}`);
    process.exit(1);
  }

  await $`mkdir -p ${distDir}`;

  console.log('Building memlink native binaries...\n');

  for (const platform of platforms) {
    await buildPlatform(platform.os, platform.arch, platform.target);
  }

  console.log(`\n✓ All ${platforms.length} binary(ies) built to ${distDir}/`);
}

main();
