export const ALERT_SUBJECT_TYPES = ['movie', 'season'] as const;

/** Alerts are sent per movie or per season, never per series. */
export type AlertSubjectType = (typeof ALERT_SUBJECT_TYPES)[number];
