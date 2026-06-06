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

  // Try which
  try {
    const which = execSync('which memlink', { encoding: 'utf-8' }).trim();
    if (which) return which;
  } catch {
    // not found
  }

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
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

function memlinkWindowsCommand(): string {
  if (process.argv[1]?.includes('src/cli/index.ts')) {
    return `bun ${process.argv[1]}`;
  }
  try {
    const result = execSync('where memlink 2>nul || where memlink.cmd 2>nul', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    const line = result.trim().split('\n')[0];
    if (line) return `"${line}"`;
  } catch {
    // not found
  }
  return 'memlink';
}

function installWindows(): void {
  const bin = memlinkWindowsCommand();
  const taskName = 'MemlinkDaemon';
  const batPath = path.join(os.tmpdir(), 'memlink-install-task.bat');

  const bat = `@echo off
schtasks /Create /SC ONLOGON /TN "${taskName}" /TR "${bin} serve --daemon" /F /IT
schtasks /Run /TN "${taskName}"
`;
  fs.writeFileSync(batPath, bat, 'utf-8');

  try {
    execSync(
      `powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"${batPath}\"' -Verb RunAs -Wait"`,
      { stdio: 'pipe', timeout: 60000 }
    );
  } catch (e) {
    console.log(err('Failed to create scheduled task', String(e)));
    try { fs.unlinkSync(batPath); } catch { /* ignore */ }
    console.log(dimLine('Open PowerShell as Administrator and run:'));
    console.log(dimLine(`  schtasks /Create /SC ONLOGON /TN "${taskName}" /TR "${bin} serve --daemon" /F /IT`));
    return;
  }

  try { fs.unlinkSync(batPath); } catch { /* ignore */ }

  console.log(ok('memlink installed as Windows Scheduled Task'));
  console.log(info('Task', taskName));
  console.log(dimLine('Manage: taskschd.msc → Task Scheduler Library → MemlinkDaemon'));
}

function uninstallWindows(): void {
  const taskName = 'MemlinkDaemon';
  const batPath = path.join(os.tmpdir(), 'memlink-uninstall-task.bat');

  const bat = `@echo off
schtasks /End /TN "${taskName}" >nul 2>&1
schtasks /Delete /TN "${taskName}" /F
`;
  fs.writeFileSync(batPath, bat, 'utf-8');

  try {
    execSync(
      `powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"${batPath}\"' -Verb RunAs -Wait"`,
      { stdio: 'pipe', timeout: 30000 }
    );
  } catch {
    // ignore (task may not exist)
  }

  try { fs.unlinkSync(batPath); } catch { /* ignore */ }
  console.log(ok('memlink scheduled task removed'));
}
