import type { ApplyResult } from './ApplyResult.js';
import type { Tally } from './Tally.js';

const line = (label: string, t: Tally): string =>
  `  ${label.padEnd(11)} created ${t.created}, updated ${t.updated}, unchanged ${t.unchanged}`;

export function formatApplyResult(result: ApplyResult): string {
  const lines = [
    'Applied:',
    line('movies:', result.movies),
    line('series:', result.series),
    line('seasons:', result.seasons),
    line('videogames:', result.videogames),
    line('books:', result.books),
    line('unlinked:', result.unlinked),
    `  unlinked rows resolved by a later import: ${result.unlinkedResolved}`,
    '',
    'Images:',
    `  local files stored: ${result.images.localStored}`,
    `  remote URLs linked to an existing local copy: ${result.images.remoteLinked}`,
    `  remote URLs imported from images directories: ${result.images.remoteImported}`,
    `  remote URLs without a local copy (left empty): ${result.images.remoteUnavailable}`,
  ];
  if (result.warnings.length > 0)
    lines.push('', 'Warnings:', ...result.warnings.map((w) => `  ${w}`));
  return lines.join('\n');
}
