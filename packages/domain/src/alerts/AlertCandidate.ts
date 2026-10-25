import type { AlertSubjectType } from './AlertSubjectType.js';

/** What the provider says about a movie or season right now. */
export interface AlertCandidate {
  subjectType: AlertSubjectType;
  subjectId: number;
  /** First day the movie or season is released in Spain, when the provider knows it. */
  releaseDate: string | null;
  /** Whether a `flatrate` provider is listed for Spain. `buy` and `rent` never count. */
  flatrateEs: boolean;
}
