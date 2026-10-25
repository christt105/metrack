export const ISSUE_DESCRIPTIONS = {
  'parse-error': 'Frontmatter could not be parsed; note skipped',
  'unknown-type': 'Missing or unknown `type`; note skipped',
  'unknown-field': 'Frontmatter fields the importer does not know',
  'missing-title': 'No title; the file name is used',
  'missing-id': 'No external id; the title goes to the unlinked inbox',
  'invalid-id': 'External id is not a valid value; ignored',
  'duplicate-key': 'Same external id as an earlier note; goes to the unlinked inbox',
  'duplicate-season':
    'Same series and season number as an earlier note; goes to the unlinked inbox',
  'orphan-season':
    'Season whose series note was not found or is unlinked; goes to the unlinked inbox',
  'missing-season-number': 'Season without a valid `season_number`; note skipped',
  'unknown-status': 'Status value not recognised; imported as planned',
  'missing-status': 'No status; imported as planned',
  'odd-date': 'Date that is not a valid YYYY-MM-DD; ignored',
  'odd-rating': 'Rating that is not a number from 0 to 10; ignored',
  'missing-image': 'Local image that does not exist; ignored',
  'series-tracking-ignored':
    'Series note with season notes also carries status, date, rating or rewatches, which the model keeps on seasons only',
  'completed-without-date': 'Completed without a `date`, so finished_at stays empty',
} as const;

export type IssueCode = keyof typeof ISSUE_DESCRIPTIONS;
