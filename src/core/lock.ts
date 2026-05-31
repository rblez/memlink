import fs from 'fs';
import path from 'path';
import os from 'os';
import { LOCK_TTL } from './types.ts';

function lockPath(memoryDir: string): string {
  return path.join(memoryDir, '.lock');
}

function readLock(memoryDir: string): { pid: number; hostname: string; lockedAt: number } | null {
  try {
    const raw = fs.readFileSync(lockPath(memoryDir), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isStale(lockedAt: number): boolean {
  return Date.now() - lockedAt > LOCK_TTL;
}

export function isLocked(memoryDir: string): boolean {
  const lock = readLock(memoryDir);
  if (!lock) return false;
  if (isStale(lock.lockedAt)) return false;
  return true;
}

export function acquireLock(memoryDir: string, _ttl: number = LOCK_TTL): boolean {
  fs.mkdirSync(memoryDir, { recursive: true });

  // Check for stale lock first
  const existing = readLock(memoryDir);
  if (existing && isStale(existing.lockedAt)) {
    try {
      fs.unlinkSync(lockPath(memoryDir));
    } catch {
      /* race */
    }
  }

  // Try exclusive create
  for (let i = 0; i < 50; i++) {
    try {
      const fd = fs.openSync(lockPath(memoryDir), 'wx');
      const lockData = JSON.stringify({
        pid: process.pid,
        hostname: os.hostname(),
        lockedAt: Date.now(),
      });
      fs.writeFileSync(fd, lockData, 'utf-8');
      fs.closeSync(fd);
      return true;
    } catch {
      // Lock exists — wait 100ms and retry
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }

  return false;
}

export function releaseLock(memoryDir: string): void {
  try {
    const lock = readLock(memoryDir);
    if (lock && lock.pid === process.pid) {
      fs.unlinkSync(lockPath(memoryDir));
    }
  } catch {
    // already released or stale
  }
}

export function withLock<T>(memoryDir: string, fn: () => T): T {
  if (!acquireLock(memoryDir)) {
    throw new Error('Could not acquire lock. Try again.');
  }
  try {
    return fn();
  } finally {
    releaseLock(memoryDir);
  }
}
