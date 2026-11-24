import type { Viewing } from '@metrack/domain';

/** One viewing of one episode in the history, with the rest of the episode's viewings (see `seasonHistory`). */
export interface HistoryRow {
  key: string;
  number: number;
  title: string | null;
  viewing: Viewing;
  others: Viewing[];
}
