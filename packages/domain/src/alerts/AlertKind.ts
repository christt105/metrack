export const ALERT_KINDS = ['releases_tomorrow', 'releases_today', 'available_es'] as const;

/** What an alert announces: the premiere is a day away, the premiere is today, or a Spanish flatrate provider has it. */
export type AlertKind = (typeof ALERT_KINDS)[number];
