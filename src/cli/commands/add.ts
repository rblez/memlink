import { ensureDefaultMemory, readMeta } from '../../core/meta.ts';
import { createEntry } from '../../core/storage.ts';
import { ok, err, dimLine } from '../output.ts';

export function addCommand(
  title: string,
  content: string,
  opts: { tags?: string; memory?: string } = {}
): void {
  const memoryName = opts.memory || 'default';
  const tags = opts.tags
    ? opts.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  let memoryId: string;

  if (memoryName === 'default') {
    const meta = ensureDefaultMemory();
    if (!meta) {
      console.log(err('Default memory not found'));
      process.exit(1);
    }
    memoryId = meta.id;
  } else {
    const meta = readMeta(memoryName);
    if (!meta) {
      console.log(err(`Memory "${memoryName}" not found`));
      console.log(dimLine(`Start it with: memlink serve --memory ${memoryName}`));
      process.exit(1);
    }
    memoryId = meta.id;
  }

  const result = createEntry(memoryName, memoryId, title, content, tags);
  console.log(ok(`Entry saved (id: ${result.id})`));
  console.log(dimLine(`Title: ${title}`));
  if (tags?.length) console.log(dimLine(`Tags: ${tags.join(', ')}`));
  if (opts.memory) console.log(dimLine(`Memory: ${memoryName}`));
}
