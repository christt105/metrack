import type { ImageSource } from './ImageSource.js';
import type { ImportPlan } from './ImportPlan.js';

/** Every image reference in the plan, one per cover or banner slot. */
export function collectImageSources(plan: ImportPlan): ImageSource[] {
  const slots = [
    ...plan.movies,
    ...plan.videogames,
    ...plan.books,
    ...plan.series,
    ...plan.series.flatMap((series) => series.seasons),
  ];
  return slots.flatMap((slot) => [slot.cover, slot.banner]).filter((s) => s !== null);
}
