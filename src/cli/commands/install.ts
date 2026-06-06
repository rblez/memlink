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
  const dataDir = getMemlinkDir();
  const taskName = 'MemlinkDaemon';
  const xmlPath = path.join(os.tmpdir(), 'memlink-task.xml');

  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Memlink — Universal memory for AI agents</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <Enabled>true</Enabled>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>/c "${bin} serve --daemon"</Arguments>
    </Exec>
  </Actions>
  <EnvironmentVariables>
    <Variable>
      <Name>MEMLINK_DIR</Name>
      <Value>${dataDir}</Value>
    </Variable>
  </EnvironmentVariables>
</Task>`;

  fs.writeFileSync(xmlPath, Buffer.from(xml, 'utf-16le'));

  try {
    execSync(
      `schtasks /Create /XML "${xmlPath}" /TN "${taskName}" /F`,
      { stdio: 'pipe' }
    );
    execSync(
      `schtasks /Run /TN "${taskName}"`,
      { stdio: 'pipe' }
    );
  } catch (e) {
    console.log(err('Failed to create/start scheduled task', String(e)));
  }

  try {
    fs.unlinkSync(xmlPath);
  } catch {
    // ignore
  }

  console.log(ok('memlink installed as Windows Scheduled Task'));
  console.log(info('Task', taskName));
  console.log(dimLine('Manage: taskschd.msc → Task Scheduler Library → MemlinkDaemon'));
}

function uninstallWindows(): void {
  const taskName = 'MemlinkDaemon';
  try {
    execSync(`schtasks /End /TN "${taskName}"`, { stdio: 'pipe' });
  } catch {
    // ignore
  }
  try {
    execSync(`schtasks /Delete /TN "${taskName}" /F`, { stdio: 'pipe' });
  } catch {
    // ignore
  }
  console.log(ok('memlink scheduled task removed'));
}
