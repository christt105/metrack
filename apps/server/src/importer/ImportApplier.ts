import type { DatabaseSync } from 'node:sqlite';
import type { ImageStore } from '../images/ImageStore.js';
import { ImageResolver } from './ImageResolver.js';
import { mergeIntoExisting } from './mergeIntoExisting.js';
import type { ApplyResult } from './ApplyResult.js';
import type { ImportPlan } from './ImportPlan.js';
import type { ImportTargets } from './ImportTargets.js';
import type { PlannedEntity } from './PlannedEntity.js';
import type { Tally } from './Tally.js';

export const IMPORT_SOURCE = 'obsidian-import';

type Resolved = { cover: string | null; banner: string | null };

/**
 * Writes an import plan through the repositories. Repeating it is safe: rows are matched by their
 * external id (seasons by series and number, unlinked titles by note path) and only changed
 * fields are written.
 */
export class ImportApplier {
  constructor(
    private readonly db: DatabaseSync,
    private readonly targets: ImportTargets,
    private readonly imageStore: ImageStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async apply(plan: ImportPlan): Promise<ApplyResult> {
    const result = emptyResult();
    const resolver = new ImageResolver(this.imageStore, result.images, result.warnings);
    const images = new Map<PlannedEntity<unknown>, Resolved>();
    const slots: PlannedEntity<unknown>[] = [
      ...plan.movies,
      ...plan.videogames,
      ...plan.books,
      ...plan.series,
      ...plan.series.flatMap((series) => series.seasons),
    ];
    for (const slot of slots) {
      images.set(slot, {
        cover: await resolver.resolve(slot.cover, slot.path),
        banner: await resolver.resolve(slot.banner, slot.path),
      });
    }

    this.db.exec('BEGIN');
    try {
      this.write(plan, images, result);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return result;
  }

  private write(
    plan: ImportPlan,
    images: Map<PlannedEntity<unknown>, Resolved>,
    result: ApplyResult,
  ): void {
    const { movies, series, seasons, videogames, books, unlinked } = this.targets;
    const withImages = <T extends object>(slot: PlannedEntity<T>) => ({
      ...slot.entity,
      ...nonNull(images.get(slot)),
    });

    for (const slot of plan.movies) {
      const existing =
        slot.entity.tmdbId === null ? undefined : movies.findByTmdbId(slot.entity.tmdbId);
      upsert(
        result.movies,
        existing,
        withImages(slot),
        (e) => movies.create(e),
        (id, p) => movies.update(id, p),
      );
    }
    for (const slot of plan.videogames) {
      const { igdbId, steamAppId } = slot.entity;
      const existing =
        igdbId !== null
          ? videogames.findByIgdbId(igdbId)
          : steamAppId !== null
            ? videogames.findBySteamAppId(steamAppId)
            : undefined;
      upsert(
        result.videogames,
        existing,
        withImages(slot),
        (e) => videogames.create(e),
        (id, p) => videogames.update(id, p),
      );
    }
    for (const slot of plan.books) {
      const { openLibraryId, isbn } = slot.entity;
      const existing =
        openLibraryId !== null
          ? books.findByOpenLibraryId(openLibraryId)
          : isbn !== null
            ? books.findByIsbn(isbn)
            : undefined;
      upsert(
        result.books,
        existing,
        { ...slot.entity, cover: images.get(slot)?.cover ?? null },
        (e) => books.create(e),
        (id, p) => books.update(id, p),
      );
    }

    for (const slot of plan.series) {
      const { tmdbId, tvdbId } = slot.entity;
      const existing =
        (tmdbId !== null ? series.findByTmdbId(tmdbId) : undefined) ??
        (tvdbId !== null ? series.findByTvdbId(tvdbId) : undefined);
      const stored = upsert(
        result.series,
        existing,
        withImages(slot),
        (e) => series.create(e),
        (id, p) => series.update(id, p),
      );
      const known = seasons.listBySeries(stored.id);
      for (const seasonSlot of slot.seasons) {
        const current = known.find((season) => season.number === seasonSlot.entity.number);
        upsert(
          result.seasons,
          current,
          { ...withImages(seasonSlot), seriesId: stored.id },
          (e) => seasons.create(e),
          (id, p) => seasons.update(id, p),
        );
      }
    }

    const linkedPaths = new Set<string>([
      ...plan.movies.map((slot) => slot.path),
      ...plan.videogames.map((slot) => slot.path),
      ...plan.books.map((slot) => slot.path),
      ...plan.series.flatMap((slot) => [slot.path, ...slot.seasons.map((season) => season.path)]),
    ]);
    const unlinkedPaths = new Set(plan.unlinked.map((title) => title.path));
    for (const row of unlinked.list()) {
      const stale =
        row.sourceRef !== null &&
        linkedPaths.has(row.sourceRef) &&
        !unlinkedPaths.has(row.sourceRef);
      if (row.source === IMPORT_SOURCE && stale) {
        unlinked.delete(row.id);
        result.unlinkedResolved += 1;
      }
    }
    for (const title of plan.unlinked) {
      if (unlinked.findBySourceRef(IMPORT_SOURCE, title.path)) {
        result.unlinked.unchanged += 1;
        continue;
      }
      unlinked.create({
        mediaType: title.mediaType,
        title: title.title,
        year: title.year,
        source: IMPORT_SOURCE,
        sourceRef: title.path,
        createdAt: this.now().toISOString(),
      });
      result.unlinked.created += 1;
    }
  }
}

function nonNull(resolved: Resolved | undefined): Partial<Resolved> {
  return {
    ...(resolved?.cover ? { cover: resolved.cover } : {}),
    ...(resolved?.banner ? { banner: resolved.banner } : {}),
  };
}

function upsert<T extends { id: number }>(
  tally: Tally,
  existing: T | undefined,
  incoming: Omit<T, 'id'>,
  create: (entity: Omit<T, 'id'>) => T,
  update: (id: number, patch: Partial<Omit<T, 'id'>>) => T,
): T {
  if (!existing) {
    tally.created += 1;
    return create(incoming);
  }
  const patch = mergeIntoExisting(existing, incoming as Partial<T>) as Partial<Omit<T, 'id'>>;
  if (Object.keys(patch).length === 0) {
    tally.unchanged += 1;
    return existing;
  }
  tally.updated += 1;
  return update(existing.id, patch);
}

function emptyResult(): ApplyResult {
  const tally = (): Tally => ({ created: 0, updated: 0, unchanged: 0 });
  return {
    movies: tally(),
    series: tally(),
    seasons: tally(),
    videogames: tally(),
    books: tally(),
    unlinked: tally(),
    unlinkedResolved: 0,
    images: { localStored: 0, remoteLinked: 0, remoteUnavailable: 0 },
    warnings: [],
  };
}
