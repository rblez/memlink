import { readEntry, updateEntry, readIndex } from '../../core/storage.ts';
import { ok, err, dimLine, kv } from '../output.ts';

export function editCommand(
  id: string,
  opts: { title?: string; content?: string; tags?: string; memory?: string }
): void {
  const memoryName = opts.memory || 'default';
  const entryId = parseInt(id, 10);

  if (isNaN(entryId)) {
    console.log(err(`Invalid id: "${id}". Must be a number.`));
    console.log(dimLine('Example: memlink edit 3 --content "Updated content"'));
    process.exit(1);
  }

  if (!opts.title && !opts.content && !opts.tags) {
    console.log(err('Nothing to update. Provide at least one of: --title, --content, --tags'));
    console.log(dimLine('Example: memlink edit 3 --title "New title" --content "New content"'));
    process.exit(1);
  }

  const index = readIndex(memoryName);
  if (!index) {
    console.log(err(`Memory "${memoryName}" not found or empty`));
    process.exit(1);
  }

  const exists = index.entries.find((e) => e.id === entryId);
  if (!exists) {
    console.log(err(`Entry #${entryId} not found in memory "${memoryName}"`));
    console.log(dimLine(`List entries: memlink entries`));
    process.exit(1);
  }

  const before = readEntry(memoryName, entryId);

  const data: { title?: string; content?: string; tags?: string[] } = {};
  if (opts.title) data.title = opts.title;
  if (opts.content) data.content = opts.content;
  if (opts.tags) data.tags = opts.tags.split(',').map((t) => t.trim()).filter(Boolean);

  const updated = updateEntry(memoryName, entryId, data);
  if (!updated) {
    console.log(err(`Failed to update entry #${entryId}`));
    process.exit(1);
  }

  console.log(ok(`Entry #${entryId} updated`));
  if (opts.title && before?.title !== opts.title) {
    console.log(kv('  title', `${before?.title} → ${opts.title}`));
  }
  if (opts.content) {
    console.log(dimLine(`  content updated`));
  }
  if (opts.tags) {
    console.log(kv('  tags', data.tags?.join(', ') || '(cleared)'));
  }
}
