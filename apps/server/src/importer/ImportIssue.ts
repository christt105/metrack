import type { IssueCode } from './IssueCode.js';

export interface ImportIssue {
  code: IssueCode;
  /** Note path relative to the Media Tracker folder. */
  path: string;
  detail: string | null;
}
