import fs from 'fs';
import path from 'path';
import { getMemlinkDir, DEFAULT_MEMORY } from './types.ts';
import { readMeta, ensureDefaultMemory, updateLastServed } from './meta.ts';
import { readAuth } from './auth.ts';

interface MemoryRoute {
  memoryName: string;
  memoryId: string;
  token?: string;
  status: 'active' | 'paused' | 'stopped';
}

const routeTable = new Map<string, MemoryRoute>();

function scanMemoryDirectories(): void {
  routeTable.clear();

  const defaultMeta = ensureDefaultMemory();
  routeTable.set(DEFAULT_MEMORY, {
    memoryName: DEFAULT_MEMORY,
    memoryId: defaultMeta.id,
    token: defaultMeta.token,
    status: defaultMeta.status,
  });

  const dir = getMemlinkDir();
  const auth = readAuth();
  if (!auth.local) return;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === DEFAULT_MEMORY) continue;
      const metaPath = path.join(dir, entry.name, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.token) {
        routeTable.set(meta.token, {
          memoryName: entry.name,
          memoryId: meta.id,
          token: meta.token,
          status: meta.status ?? 'active',
        });
      }
    }
  } catch {
    // ignore
  }
}

export function initRouting(): void {
  scanMemoryDirectories();
}

export function getRoute(token?: string): MemoryRoute | null {
  if (!token) {
    const route = routeTable.get(DEFAULT_MEMORY);
    if (route && route.status === 'active') {
      updateLastServed(route.memoryName);
      return route;
    }
    return null;
  }

  const route = routeTable.get(token);
  if (!route) return null;
  if (route.status !== 'active') return null;
  updateLastServed(route.memoryName);
  return route;
}

export function registerMemoryRoute(memoryName: string, token: string): void {
  const meta = readMeta(memoryName);
  if (!meta) return;
  routeTable.set(token, {
    memoryName,
    memoryId: meta.id,
    token,
    status: meta.status ?? 'active',
  });
}

export function unregisterMemoryRoute(token: string): void {
  routeTable.delete(token);
}

export function pauseMemory(memoryName: string): void {
  for (const [, route] of routeTable.entries()) {
    if (route.memoryName === memoryName) {
      route.status = 'paused';
    }
  }
}

export function resumeMemory(memoryName: string): void {
  for (const [, route] of routeTable.entries()) {
    if (route.memoryName === memoryName) {
      route.status = 'active';
    }
  }
}

export function stopMemory(memoryName: string): void {
  for (const [key, route] of routeTable.entries()) {
    if (route.memoryName === memoryName) {
      routeTable.delete(key);
    }
  }
}

export function getRouteByMemoryName(memoryName: string): MemoryRoute | null {
  for (const route of routeTable.values()) {
    if (route.memoryName === memoryName) return route;
  }
  return null;
}

export { type MemoryRoute };
