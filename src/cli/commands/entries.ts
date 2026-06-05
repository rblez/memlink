import { table } from 'table';
import { readAllEntries } from '../../core/storage.ts';
import { ensureDefaultMemory } from '../../core/meta.ts';
import { colors, info } from '../output.ts';

export function entriesCommand(): void {
  const meta = ensureDefaultMemory();
  if (!meta) {
    console.log(info('no entries', 'Default memory not found.'));
    return;
  }

  const entries = readAllEntries('default');
  if (entries.length === 0) {
    console.log(info('empty', 'Default memory is empty. Use memlink add to write an entry.'));
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

  console.log(table(rows));
}
