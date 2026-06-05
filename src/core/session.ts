import fs from 'fs';
import path from 'path';
import { memoryDir } from './types.ts';

interface SessionData {
  lastConnectedAt: string | null;
  agent: string | null;
  reads: number;
  writes: number;
}

function sessionPath(memoryName: string): string {
  return path.join(memoryDir(memoryName), '.session');
}

export function readSession(memoryName: string): SessionData {
  try {
    const raw = fs.readFileSync(sessionPath(memoryName), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastConnectedAt: null, agent: null, reads: 0, writes: 0 };
  }
}

export function writeSession(memoryName: string, data: SessionData): void {
  const dir = memoryDir(memoryName);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = sessionPath(memoryName) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, sessionPath(memoryName));
}

export function recordConnection(memoryName: string, agent?: string): void {
  const session = readSession(memoryName);
  session.lastConnectedAt = new Date().toISOString();
  if (agent) session.agent = agent;
  writeSession(memoryName, session);
}

export function recordRead(memoryName: string): void {
  const session = readSession(memoryName);
  session.reads++;
  writeSession(memoryName, session);
}

export function recordWrite(memoryName: string): void {
  const session = readSession(memoryName);
  session.writes++;
  writeSession(memoryName, session);
}
