import { ensureDefaultMemory } from '../../core/meta.ts';
import { createEntry } from '../../core/storage.ts';
import { ok, err, dimLine } from '../output.ts';

export function addCommand(title: string, content: string): void {
  const meta = ensureDefaultMemory();
  if (!meta) {
    console.log(err('Default memory not found'));
    process.exit(1);
  }

  const result = createEntry('default', meta.id, title, content);
  console.log(ok(`Entry saved (id: ${result.id})`));
  console.log(dimLine(`Title: ${title}`));
}
