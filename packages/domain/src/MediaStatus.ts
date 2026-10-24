export const MEDIA_STATUSES = ['planned', 'in_progress', 'paused', 'dropped', 'completed'] as const;

/** Tracking state shared by every trackable entity. Maps the plugin's Sin Empezar, En Curso, Pausado, Abandonado and Acabado. */
export type MediaStatus = (typeof MEDIA_STATUSES)[number];
