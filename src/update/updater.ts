import fs from 'fs';
import path from 'path';
import os from 'os';

const REPO = 'rblez/memlink';
const API_BASE = 'https://api.github.com';

interface Release {
  tag_name: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export async function getCurrentVersion(): Promise<string> {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    return packageJson.version;
  } catch {
    return '0.0.0';
  }
}

export async function getLatestRelease(): Promise<Release | null> {
  try {
    const response = await fetch(`${API_BASE}/repos/${REPO}/releases/latest`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function getCurrentBinaryName(): string {
  const platform = os.platform();
  const arch = os.arch();

  let osName: string;
  let archName: string;

  switch (platform) {
    case 'linux':
      osName = 'linux';
      break;
    case 'darwin':
      osName = 'darwin';
      break;
    case 'win32':
      osName = 'windows';
      break;
    default:
      osName = platform;
  }

  switch (arch) {
    case 'x64':
      archName = 'x64';
      break;
    case 'arm64':
      archName = 'arm64';
      break;
    default:
      archName = arch;
  }

  const binaryName = `memlink-${osName}-${archName}`;
  return platform === 'win32' ? `${binaryName}.exe` : binaryName;
}

export async function checkForUpdates(): Promise<{
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
}> {
  const currentVersion = await getCurrentVersion();
  const release = await getLatestRelease();

  if (!release) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
    };
  }

  const latestVersion = release.tag_name.replace('v', '');
  const updateAvailable = latestVersion !== currentVersion;

  return {
    updateAvailable,
    currentVersion,
    latestVersion,
  };
}

export async function performUpdate(): Promise<boolean> {
  const release = await getLatestRelease();
  if (!release) {
    throw new Error('Failed to fetch release information');
  }

  const binaryName = getCurrentBinaryName();
  const asset = release.assets.find((a) => a.name === binaryName);

  if (!asset) {
    throw new Error(`No binary found for your platform (${binaryName})`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memlink-update-'));
  const downloadPath = path.join(tempDir, binaryName);

  // Download new binary
  const response = await fetch(asset.browser_download_url);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(downloadPath, Buffer.from(buffer));

  // Make executable
  fs.chmodSync(downloadPath, '755');

  // Get current binary path
  const currentPath = process.execPath;

  // Replace binary
  if (process.platform === 'win32') {
    // Windows: Move to temp, then replace
    const tempCurrent = currentPath + '.old';
    fs.renameSync(currentPath, tempCurrent);
    fs.copyFileSync(downloadPath, currentPath);
    fs.unlinkSync(tempCurrent);
  } else {
    // Unix: Direct replacement
    fs.copyFileSync(downloadPath, currentPath);
    fs.chmodSync(currentPath, '755');
  }

  // Cleanup
  fs.unlinkSync(downloadPath);
  fs.rmdirSync(tempDir);

  return true;
}
