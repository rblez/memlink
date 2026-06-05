import fs from 'fs';
import path from 'path';
import { getMemlinkDir, HEALTH_TTL, MEMLINK_VERSION } from './types.ts';

interface HealthData {
  status: 'ok';
  version: string;
  pid: number;
  uptime: number;
  timestamp: string;
}

function healthPath(): string {
  return path.join(getMemlinkDir(), '.health');
}

function readHealth(): HealthData | null {
  try {
    const raw = fs.readFileSync(healthPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeHealth(data: HealthData): void {
  const dir = getMemlinkDir();
  fs.mkdirSync(dir, { recursive: true });
  const tmp = healthPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, healthPath());
}

export function tickHealth(): void {
  writeHealth({
    status: 'ok',
    version: MEMLINK_VERSION,
    pid: process.pid,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

let healthInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthTicker(): void {
  stopHealthTicker();
  tickHealth();
  healthInterval = setInterval(tickHealth, HEALTH_TTL);
  healthInterval.unref();
}

export function stopHealthTicker(): void {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
}

export function isDaemonAlive(): boolean {
  const health = readHealth();
  if (!health) return false;
  const elapsed = Date.now() - new Date(health.timestamp).getTime();
  return elapsed < HEALTH_TTL * 2;
}
