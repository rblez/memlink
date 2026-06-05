import { readAuth, writeAuth, generateLocalToken } from '../../core/auth.ts';
import { ok, info, err, dimLine } from '../output.ts';

export function tokenGenerateCommand(): void {
  const auth = readAuth();
  const token = generateLocalToken();
  auth.local = { token, createdAt: new Date().toISOString() };
  writeAuth(auth);
  console.log(ok('Token generated'));
  console.log(info('Token', token));
  console.log(dimLine('Use: memlink serve --memory <name> to register an isolated memory'));
}

export function tokenListCommand(): void {
  const auth = readAuth();
  if (!auth.local) {
    console.log(info('no tokens', 'No local tokens found.'));
    return;
  }
  console.log(info('Local token', auth.local.token));
  console.log(info('Created', auth.local.createdAt));
  if (auth.cloud) {
    console.log(info('Cloud user', auth.cloud.userId));
  }
}

export function tokenRevokeCommand(label?: string): void {
  const auth = readAuth();
  if (!auth.local) {
    console.log(err('No token to revoke'));
    return;
  }
  auth.local = null;
  writeAuth(auth);
  console.log(ok('Token revoked'));
  if (label) console.log(dimLine(`Label: ${label}`));
}
