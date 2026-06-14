import { searchEntries, readIndex } from '../../core/storage.ts';
import { ensureDefaultMemory } from '../../core/meta.ts';
import { colors, info, err, dimLine } from '../output.ts';

export function searchCommand(query: string, opts: { memory?: string } = {}): void {
  const memoryName = opts.memory || 'default';

  if (memoryName === 'default') {
    const meta = ensureDefaultMemory();
    if (!meta) {
      console.log(info('error', 'Default memory not found.'));
      return;
    }
  } else {
    const index = readIndex(memoryName);
    if (!index) {
      console.log(err(`Memory "${memoryName}" not found or empty`));
      console.log(dimLine(`List entries: memlink entries --memory ${memoryName}`));
      return;
    }
  }

  const results = searchEntries(memoryName, query);
  if (results.length === 0) {
    console.log(
      info('no matches', `No results for "${query}"${opts.memory ? ` in ${memoryName}` : ''}`)
    );
    return;
  }

  console.log(
    info(
      'matches',
      `${results.length} result(s) for "${query}"${opts.memory ? ` in ${memoryName}` : ''}`
    )
  );
  console.log();

  for (const entry of results) {
    console.log(`  ${colors.primary(`#${entry.id} ${entry.title}`)}`);
    console.log(`  ${colors.dim(entry.updatedAt.slice(0, 10))}`);
    if (entry.tags?.length) {
      console.log(`  ${colors.dim(`Tags: ${entry.tags.join(', ')}`)}`);
    }
    const preview = entry.content.slice(0, 200);
    console.log(`  ${preview}${entry.content.length > 200 ? '…' : ''}`);
    console.log(dimLine('─'.repeat(40)));
  }
}
