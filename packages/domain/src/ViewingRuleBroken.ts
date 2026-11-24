/** Why a list of viewings cannot be stored: a start after its finish, a date in the future or an exact duplicate. */
export type ViewingRuleBroken = 'invalid_dates' | 'future_date' | 'duplicate';
