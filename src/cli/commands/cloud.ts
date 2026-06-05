import { ok, info, dimLine } from '../output.ts';

export function connectCommand(): void {
  console.log(info('cloud', 'memlink.cloud — coming in Phase 2'));
  console.log(dimLine('This command will link your CLI with memlink.cloud.'));
  console.log(dimLine('For now, use local tokens with memlink token.'));
}

export function disconnectCommand(): void {
  console.log(ok('Disconnected from cloud'));
  console.log(dimLine('Cloud features coming in Phase 2.'));
}
