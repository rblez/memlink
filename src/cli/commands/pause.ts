import { readMeta, updateMetaStatus } from '../../core/meta.ts';
import { pauseMemory, resumeMemory, stopMemory, getRouteByMemoryName } from '../../core/routing.ts';
import { ok, err, dimLine } from '../output.ts';

export function pauseCommand(memoryName?: string): void {
  const name = memoryName || 'default';
  const meta = readMeta(name);
  if (!meta) {
    console.log(err(`Memory not found: ${name}`));
    process.exit(1);
  }

  pauseMemory(name);
  updateMetaStatus(name, 'paused');
  console.log(ok(`Memory paused: ${name}`));
  console.log(dimLine('Data intact. Resume with memlink serve --memory ' + name));
}

export function resumeCommand(memoryName?: string): void {
  const name = memoryName || 'default';
  resumeMemory(name);
  updateMetaStatus(name, 'active');
  console.log(ok(`Memory resumed: ${name}`));
}

export function stopMemoryCommand(memoryName?: string): void {
  const name = memoryName || 'default';
  const route = getRouteByMemoryName(name);
  if (!route) {
    console.log(err(`Memory not active: ${name}`));
    return;
  }

  stopMemory(name);
  updateMetaStatus(name, 'stopped');
  console.log(ok(`Memory stopped: ${name}`));
  console.log(dimLine('Remove from routing. Data intact.'));
}
