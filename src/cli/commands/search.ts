import { searchEntries } from '../../core/storage.ts';
import { ensureDefaultMemory } from '../../core/meta.ts';
import { colors, info, dimLine } from '../output.ts';

export function searchCommand(query: string): void {
  const meta = ensureDefaultMemory();
  if (!meta) {
    console.log(info('error', 'Default memory not found.'));
    return;
  }

  const results = searchEntries('default', query);
  if (results.length === 0) {
    console.log(info('no matches', `No results for "${query}"`));
    return;
  }

  console.log(info('matches', `${results.length} result(s) for "${query}"`));
  console.log();

  for (const entry of results) {
    console.log(`  ${colors.primary(`# ${entry.title}`)}`);
    console.log(`  ${colors.dim(entry.updatedAt.slice(0, 10))}`);
    if (entry.tags?.length) {
      console.log(`  ${colors.dim(`Tags: ${entry.tags.join(', ')}`)}`);
    }
    const preview = entry.content.slice(0, 200);
    console.log(`  ${preview}${entry.content.length > 200 ? '…' : ''}`);
    console.log(dimLine('─'.repeat(40)));
  }
}
