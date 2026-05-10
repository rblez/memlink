#!/usr/bin/env bun
import { $ } from "bun";
import path from "path";

const platforms = [
  { os: "linux", arch: "x64", target: "bun-linux-x64" },
  { os: "linux", arch: "arm64", target: "bun-linux-arm64" },
  { os: "darwin", arch: "x64", target: "bun-darwin-x64" },
  { os: "darwin", arch: "arm64", target: "bun-darwin-arm64" },
  { os: "windows", arch: "x64", target: "bun-windows-x64" },
];

const distDir = path.join(process.cwd(), "dist", "binaries");
const entryPoint = path.join(process.cwd(), "src", "cli", "index.ts");

console.log("Building Memlink standalone binaries...\n");

// Create dist directory
await $`mkdir -p ${distDir}`;

// Build for each platform
for (const platform of platforms) {
  const { os, arch, target } = platform;
  const outputName = os === "windows" ? `memlink-${os}-${arch}.exe` : `memlink-${os}-${arch}`;
  const outputPath = path.join(distDir, outputName);

  console.log(`Building for ${os}-${arch}...`);

  try {
    await $`bun build --compile --target ${target} --outfile ${outputPath} ${entryPoint}`;
    console.log(`✓ Built ${outputName}`);
  } catch (error) {
    console.error(`✗ Failed to build for ${target}:`, error);
    process.exit(1);
  }
}

console.log("\n✓ All binaries built successfully!");
console.log(`Output directory: ${distDir}`);
