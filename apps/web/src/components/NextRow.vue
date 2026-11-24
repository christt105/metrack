<script setup lang="ts">
import { computed, ref } from 'vue';
import { sizedImageUrl, type NextEpisodeRow } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';
import { stillUrl } from '../logic/stillUrl';
import type { RowMenuItem } from '../logic/RowMenuItem';
import AppIcon from './AppIcon.vue';
import RowMenu from './RowMenu.vue';
import SeasonProgress from './SeasonProgress.vue';

const messages = useMessages();
const props = defineProps<{ row: NextEpisodeRow; busy: boolean }>();
const emit = defineEmits<{ mark: []; skip: []; hide: []; restart: [] }>();

const imageFailed = ref(false);
const image = computed(() => {
  if (imageFailed.value) return null;
  const { episode, season, series } = props.row;
  const still = stillUrl(episode.stillPath);
  if (still) return still;
  const cover = season.cover ?? series.cover ?? series.banner;
  return cover ? sizedImageUrl(cover, 'thumb') : null;
});
const rewatching = computed(
  () => props.row.progress.rewatch || props.row.labels.includes('rewatch'),
);
const restartable = computed(
  () =>
    props.row.source !== 'numbers' &&
    props.row.progress.watched !== null &&
    props.row.progress.watched - props.row.progress.skipped > 0,
);
const menuItems = computed<RowMenuItem[]>(() => [
  ...(restartable.value ? [{ id: 'restart', label: messages.next.restart }] : []),
  { id: 'hide', label: messages.next.hide },
]);

function onMenu(id: string): void {
  if (id === 'hide') emit('hide');
  if (id === 'restart') emit('restart');
}
const ready = computed(() => props.row.availability === 'ready');
const filler = computed(() => props.row.episode.filler);
const fillerHint = computed(() => filler.value === 'filler' || filler.value === 'mixed');
const label = computed(() =>
  messages.next.episodeLabel(props.row.season.number, props.row.episode.number),
);
const heading = computed(() => {
  const { availability, airsOn, season, episode } = props.row;
  if (availability === 'airs' && airsOn)
    return messages.next.airs(season.number, episode.number, messages.episodes.airDate(airsOn));
  if (availability === 'premieres' && airsOn)
    return messages.next.premieres(season.number, messages.episodes.airDate(airsOn));
  return episode.title ? `${label.value}  ${episode.title}` : label.value;
});
const meta = computed(() =>
  [
    ready.value && props.row.episode.airDate
      ? messages.episodes.airDate(props.row.episode.airDate)
      : null,
    props.row.episode.runtime ? messages.episodes.minutes(props.row.episode.runtime) : null,
  ]
    .filter(Boolean)
    .join(' · '),
);
</script>

<template>
  <li class="next" :class="{ waiting: !ready }" :data-series="row.series.id">
    <RouterLink
      class="main"
      :to="`/seasons/${row.season.id}`"
      :aria-label="messages.next.open(row.series.title)"
    >
      <span class="still">
        <img
          v-if="image"
          :src="image"
          alt=""
          width="96"
          height="54"
          loading="lazy"
          decoding="async"
          @error="imageFailed = true"
        />
      </span>
      <span class="text">
        <span class="series">{{ row.series.title }}</span>
        <span class="episode">
          <span class="episode__title">{{ heading }}</span>
          <span
            v-if="fillerHint && filler && ready"
            class="filler-mark"
            :title="
              filler === 'filler'
                ? messages.episodes.fillerLabel
                : messages.episodes.mixedFillerLabel
            "
          >
            <AppIcon :name="filler === 'filler' ? 'filler' : 'mixedFiller'" :size="16" />
          </span>
        </span>
        <span v-if="meta" class="meta muted">{{ meta }}</span>
        <span v-if="row.labels.length > 0" class="labels">
          <span v-if="row.labels.includes('rewatch')" class="label">{{
            messages.next.rewatch
          }}</span>
          <span v-if="row.labels.includes('newSeason')" class="label">{{
            messages.next.newSeason
          }}</span>
        </span>
        <SeasonProgress
          :watched="row.progress.watched"
          :total="row.progress.total"
          :skipped="row.progress.skipped"
          :rewatch="row.progress.rewatch"
        />
      </span>
    </RouterLink>
    <div class="actions">
      <RowMenu
        :label="messages.next.menu(row.series.title)"
        :items="menuItems"
        :disabled="busy"
        @select="onMenu"
      />
      <button
        v-if="ready && !rewatching"
        type="button"
        class="act skip"
        :class="{ highlight: fillerHint }"
        :disabled="busy"
        :aria-label="messages.next.skip(row.series.title)"
        :title="fillerHint ? messages.next.skipFiller : undefined"
        @click="emit('skip')"
      >
        <AppIcon name="skipForward" :size="20" />
      </button>
      <button
        v-if="ready"
        type="button"
        class="act mark"
        :disabled="busy"
        :aria-label="messages.next.mark(row.series.title)"
        @click="emit('mark')"
      >
        <AppIcon name="check" :size="22" />
      </button>
    </div>
  </li>
</template>

<style scoped>
.next {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  min-width: 0;
  padding: var(--s-3);
  border: 1px solid var(--outline);
  border-radius: var(--r-md);
  background: var(--surface-low);
}

.waiting {
  opacity: 0.75;
}

.main {
  display: flex;
  flex: 1;
  gap: var(--s-3);
  min-width: 0;
  color: var(--on-surface);
}

.main:hover {
  text-decoration: none;
}

.still {
  flex: none;
  width: 96px;
  height: 54px;
  overflow: hidden;
  border-radius: var(--r-sm);
  background: var(--surface-high);
}

.still img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.series {
  overflow: hidden;
  font-size: var(--t-body, 1rem);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.episode {
  display: flex;
  align-items: baseline;
  gap: var(--s-2);
  min-width: 0;
}

.episode__title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow-wrap: anywhere;
}

.filler-mark {
  display: inline-flex;
  flex: none;
  align-self: center;
  color: var(--muted);
}

.meta {
  font-size: var(--t-label);
}

.labels {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.label {
  padding: 1px var(--s-2);
  border: 1px solid var(--primary);
  border-radius: 999px;
  color: var(--primary);
  font-size: var(--t-label);
  white-space: nowrap;
}

.actions {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--s-2);
}

.actions :deep(.menu) {
  margin: -6px -6px 0 0;
}

.act {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  min-height: 0;
  padding: 0;
  border-radius: 50%;
}

.mark {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: var(--on-primary, var(--surface));
}

.skip {
  border: 1px solid var(--outline-strong);
  background: transparent;
}

.skip.highlight {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 25%, transparent);
  color: var(--primary);
}
</style>
