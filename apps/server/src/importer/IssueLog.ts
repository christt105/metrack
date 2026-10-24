import type { ImportIssue } from './ImportIssue.js';
import type { IssueCode } from './IssueCode.js';

export class IssueLog {
  private readonly entries: ImportIssue[] = [];

  add(code: IssueCode, path: string, detail: string | null = null): void {
    this.entries.push({ code, path, detail });
  }

  all(): ImportIssue[] {
    return [...this.entries];
  }
}
