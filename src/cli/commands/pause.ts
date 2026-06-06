import { readMeta, updateMetaStatus } from '../../core/meta.ts';
import { getRouteByMemoryName } from '../../core/routing.ts';
import { pauseMemory as routingPause, resumeMemory as routingResume, stopMemory as routingStop } from '../../core/routing.ts';
import * as admin from '../admin.ts';
import { ok, err, dimLine } from '../output.ts';

export async function pauseCommand(memoryName?: string): Promise<void> {
  const name = memoryName || 'default';
  const meta = readMeta(name);
  if (!meta) {
    console.log(err(`Memory not found: ${name}`));
    process.exit(1);
  }

  const result = await admin.pauseMemory(name);
  if (result.ok) {
    console.log(ok(`Memory paused: ${name}`));
  } else {
    routingPause(name);
    updateMetaStatus(name, 'paused');
    console.log(ok(`Memory paused: ${name} (local)`));
  }
  console.log(dimLine('Data intact. Resume with memlink resume --memory ' + name));
}

export async function resumeCommand(memoryName?: string): Promise<void> {
  const name = memoryName || 'default';
  const result = await admin.resumeMemory(name);
  if (result.ok) {
    console.log(ok(`Memory resumed: ${name}`));
  } else {
    routingResume(name);
    updateMetaStatus(name, 'active');
    console.log(ok(`Memory resumed: ${name} (local)`));
  }
}

export async function stopMemoryCommand(memoryName?: string): Promise<void> {
  const name = memoryName || 'default';
  const result = await admin.stopMemory(name);
  if (result.ok) {
    console.log(ok(`Memory stopped: ${name}`));
  } else {
    const route = getRouteByMemoryName(name);
    if (!route) {
      console.log(err(`Memory not active: ${name}`));
      return;
    }
    routingStop(name);
    updateMetaStatus(name, 'stopped');
    console.log(ok(`Memory stopped: ${name} (local)`));
  }
  console.log(dimLine('Removed from routing. Data intact.'));
}
