<script setup lang="ts">
import { sizedImageUrl, type Season } from '@metrack/domain';
import { messages } from '../i18n/messages';
import { seasonWatched } from '../logic/seasonWatched';
import PendingBadge from './PendingBadge.vue';
import SeasonProgress from './SeasonProgress.vue';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{ seasons: Season[]; seriesCover?: string | null }>();

function label(season: Season): string {
  return `${messages.typeLabels.season} ${season.number}`;
}

function coverOf(season: Season): string | null {
  return season.cover ?? props.seriesCover ?? null;
}
</script>

<template>
  <section class="seasons-section" aria-labelledby="seasons-title">
    <h2 id="seasons-title">{{ messages.detail.sectionSeasons }}</h2>
    <p v-if="seasons.length === 1" class="muted note">{{ messages.detail.singleSeasonNote }}</p>
    <p v-if="seasons.length === 0" class="muted note">{{ messages.detail.noSeasons }}</p>
    <ul class="seasons">
      <li v-for="season in seasons" :key="season.id">
        <RouterLink :to="`/seasons/${season.id}`" class="season">
          <span class="poster">
            <img
              v-if="coverOf(season)"
              :src="sizedImageUrl(coverOf(season) as string, 'thumb')"
              alt=""
              width="342"
              height="513"
              loading="lazy"
              decoding="async"
            />
          </span>
          <span class="body">
            <strong class="name">{{ label(season) }}</strong>
            <span v-if="season.title && season.title !== label(season)" class="subtitle muted">{{
              season.title
            }}</span>
            <span class="states">
              <StatusBadge :status="season.status" />
              <span v-if="season.rating !== null" class="rating">{{ season.rating }}/10</span>
              <PendingBadge v-if="season.pendingReview" />
            </span>
            <SeasonProgress :watched="seasonWatched(season)" :total="season.episodeCount" />
          </span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.seasons-section {
  margin-bottom: var(--s-7);
}

.note {
  margin-bottom: var(--s-4);
}

.seasons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--s-3);
  list-style: none;
  padding: 0;
  margin: 0 0 var(--s-4);
}

.season {
  display: flex;
  gap: var(--s-4);
  height: 100%;
  padding: var(--s-3);
  border: 1px solid var(--outline);
  border-radius: var(--r-md);
  background: var(--surface-low);
  color: var(--on-surface);
  transition:
    transform 120ms var(--ease),
    border-color 120ms var(--ease);
}

.season:hover {
  text-decoration: none;
}

.poster {
  flex: none;
  width: 72px;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: var(--r-sm);
  background: var(--surface-high);
}

.poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.name {
  font-weight: 500;
}

.subtitle {
  margin-top: -4px;
  overflow: hidden;
  font-size: var(--t-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.states {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.rating {
  font-size: var(--t-label);
  font-weight: 600;
}

.body :deep(.progress) {
  margin-top: auto;
}

@media (hover: hover) and (pointer: fine) {
  .season:hover {
    transform: translateY(-2px);
    border-color: var(--outline-strong);
    transition-duration: 180ms;
  }
}

@media (max-width: 599px) {
  .seasons {
    grid-template-columns: 1fr;
  }
}
</style>
