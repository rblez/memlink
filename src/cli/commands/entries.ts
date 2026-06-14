import { table } from 'table';
import { readAllEntries, readIndex } from '../../core/storage.ts';
import { ensureDefaultMemory } from '../../core/meta.ts';
import { colors, info, err, dimLine } from '../output.ts';

export function entriesCommand(opts: { memory?: string } = {}): void {
  const memoryName = opts.memory || 'default';

  if (memoryName === 'default') {
    const meta = ensureDefaultMemory();
    if (!meta) {
      console.log(info('no entries', 'Default memory not found.'));
      return;
    }
  } else {
    const index = readIndex(memoryName);
    if (!index) {
      console.log(err(`Memory "${memoryName}" not found or empty`));
      console.log(dimLine(`Start it with: memlink serve --memory ${memoryName}`));
      return;
    }
  }

  const entries = readAllEntries(memoryName);
  if (entries.length === 0) {
    console.log(
      info(
        'empty',
        `Memory "${memoryName}" is empty. Use memlink add --memory ${memoryName} to write an entry.`
      )
    );
    return;
  }

  const rows = [
    [colors.white('ID'), colors.white('Title'), colors.white('Tags'), colors.white('Updated')],
    ...entries.map((e) => [
      String(e.id),
      e.title,
      (e.tags?.length ?? 0) > 0 ? e.tags!.join(', ') : colors.dim('—'),
      e.updatedAt.slice(0, 10),
    ]),
  ];

  if (opts.memory) {
    console.log(info('memory', memoryName));
    console.log();
  }

  console.log(table(rows));
}
