import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getMemlinkDir, AUTH_FILE, type AuthData } from './types.ts';

function authPath(): string {
  return path.join(getMemlinkDir(), AUTH_FILE);
}

export function readAuth(): AuthData {
  try {
    const raw = fs.readFileSync(authPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { local: null, cloud: null };
  }
}

export function writeAuth(data: AuthData): void {
  const dir = getMemlinkDir();
  fs.mkdirSync(dir, { recursive: true });
  const tmp = authPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, authPath());
}

export function generateLocalToken(): string {
  return 'ml_' + nanoid(16);
}

export function ensureLocalToken(): string {
  const auth = readAuth();
  if (auth.local) return auth.local.token;
  const token = generateLocalToken();
  auth.local = { token, createdAt: new Date().toISOString() };
  writeAuth(auth);
  return token;
}

export function getLocalToken(): string | null {
  const auth = readAuth();
  return auth.local?.token ?? null;
}
