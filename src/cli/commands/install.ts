import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { getMemlinkDir } from '../../core/types.ts';
import { ok, err, info, dimLine } from '../output.ts';

function memlinkBinaryPath(): string {
  // Try to find the memlink binary
  const paths = [
    path.join(process.argv[1] || '', '..', '..', 'cli', 'index.js'),
    '/usr/local/bin/memlink',
    path.join(os.homedir(), '.local', 'bin', 'memlink'),
  ];

  // Check if we're running from source (bun)
  if (process.argv[1]?.includes('src/cli/index.ts')) {
    return `bun ${process.argv[1]}`;
  }

  // Try which, then resolve symlinks (fnm/nvm shims have unstable per-shell paths)
  try {
    const which = execSync('which memlink', { encoding: 'utf-8' }).trim();
    if (which) {
      try {
        return fs.realpathSync(which);
      } catch {
        return which;
      }
    }
  } catch {
    // not found
  }

  for (const p of paths) {
    if (fs.existsSync(p)) return fs.realpathSync(p);
  }

  return 'memlink'; // fallback — assume in PATH
}

export function installCommand(): void {
  const platform = process.platform;

  if (platform === 'linux') {
    installLinux();
  } else if (platform === 'darwin') {
    installMacOS();
  } else if (platform === 'win32') {
    installWindows();
  } else {
    console.log(err(`Platform not supported yet: ${platform}`));
    console.log(dimLine('Manual setup: run memlink serve --daemon'));
  }
}

export function uninstallCommand(): void {
  const platform = process.platform;

  if (platform === 'linux') {
    uninstallLinux();
  } else if (platform === 'darwin') {
    uninstallMacOS();
  } else if (platform === 'win32') {
    uninstallWindows();
  } else {
    console.log(err(`Platform not supported yet: ${platform}`));
  }
}

function installLinux(): void {
  const systemdDir = path.join(os.homedir(), '.config', 'systemd', 'user');
  const servicePath = path.join(systemdDir, 'memlink.service');
  const bin = memlinkBinaryPath();
  const dataDir = getMemlinkDir();

  const service = `[Unit]
Description=Memlink — Universal memory for AI agents
After=network.target

[Service]
Type=simple
ExecStart=${bin} serve
Restart=on-failure
RestartSec=5
Environment=MEMLINK_DIR=${dataDir}

[Install]
WantedBy=default.target
`;

  fs.mkdirSync(systemdDir, { recursive: true });
  fs.writeFileSync(servicePath, service, 'utf-8');

  try {
    execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
    execSync('systemctl --user enable memlink', { stdio: 'pipe' });
    execSync('systemctl --user start memlink', { stdio: 'pipe' });
  } catch (e) {
    console.log(err('Failed to enable/start service', String(e)));
  }

  console.log(ok('memlink installed as systemd user service'));
  console.log(info('Service', servicePath));
  console.log(dimLine('Status: systemctl --user status memlink'));
  console.log(dimLine('Logs: journalctl --user -u memlink -f'));
}

function uninstallLinux(): void {
  try {
    execSync('systemctl --user stop memlink', { stdio: 'pipe' });
    execSync('systemctl --user disable memlink', { stdio: 'pipe' });
  } catch {
    // ignore
  }

  const servicePath = path.join(os.homedir(), '.config', 'systemd', 'user', 'memlink.service');
  if (fs.existsSync(servicePath)) {
    fs.unlinkSync(servicePath);
  }

  try {
    execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
  } catch {
    // ignore
  }

  console.log(ok('memlink service removed'));
}

function installMacOS(): void {
  const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  const plistPath = path.join(launchAgentsDir, 'memlink.plist');
  const bin = memlinkBinaryPath();
  const dataDir = getMemlinkDir();

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>memlink</string>
  <key>ProgramArguments</key>
  <array>
    <string>${bin}</string>
    <string>serve</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>MEMLINK_DIR</key>
    <string>${dataDir}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${dataDir}/memlink.log</string>
  <key>StandardErrorPath</key>
  <string>${dataDir}/memlink.log</string>
</dict>
</plist>
`;

  fs.mkdirSync(launchAgentsDir, { recursive: true });
  fs.writeFileSync(plistPath, plist, 'utf-8');

  try {
    execSync(`launchctl load ${plistPath}`, { stdio: 'pipe' });
  } catch (e) {
    console.log(err('Failed to load launch agent', String(e)));
  }

  console.log(ok('memlink installed as LaunchAgent'));
  console.log(info('Plist', plistPath));
  console.log(dimLine('Status: launchctl list memlink'));
}

function uninstallMacOS(): void {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'memlink.plist');
  try {
    execSync(`launchctl unload ${plistPath}`, { stdio: 'pipe' });
  } catch {
    // ignore
  }
  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
  }
  console.log(ok('memlink LaunchAgent removed'));
}

function installWindows(): void {
  console.log(ok('memlink installed'));
  console.log('');
  console.log(info('To start the daemon', ''));
  console.log('  memlink serve --daemon');
  console.log('');
  console.log(info('For 24/7 background on Windows', ''));
  console.log('  Windows has no native user-daemon. Run `memlink serve --daemon`');
  console.log('  in a persistent terminal (Windows Terminal, ConEmu, or screen/tmux),');
  console.log('  or use an external supervisor:');
  console.log(
    '    • NSSM:  nssm.exe install Memlink "%LOCALAPPDATA%\\memlink\\memlink.exe" "serve --daemon"'
  );
  console.log('    • pm2:   pm2 start memlink -- serve --daemon');
  console.log('    • Task Scheduler: create a basic task that runs on logon');
  console.log('');
  console.log(dimLine('Status: memlink status'));
  console.log(dimLine('Stop:   memlink stop'));
}

function uninstallWindows(): void {
  console.log(ok('memlink uninstalled (no service was registered)'));
  console.log(dimLine('Stop any running daemon: memlink stop'));
}
