<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SeasonEpisodeItem, Viewing } from '@metrack/domain';
import { messages } from '../i18n/messages';
import { hasAired } from '../logic/episodeSelection';
import AppIcon from './AppIcon.vue';
import EpisodeViewings from './EpisodeViewings.vue';

const props = defineProps<{
  episode: SeasonEpisodeItem;
  numbered: boolean;
  today: string;
  busy: boolean;
}>();
const emit = defineEmits<{
  toggle: [];
  markUpTo: [dated: boolean];
  viewings: [viewings: Viewing[]];
}>();

const open = ref(false);
const aired = computed(() => hasAired(props.episode, props.today));
const name = computed(() =>
  props.numbered && props.episode.title
    ? props.episode.title
    : messages.episodes.episode(props.episode.number),
);
const meta = computed(() =>
  [
    props.episode.airDate ? messages.episodes.airDate(props.episode.airDate) : null,
    props.episode.runtime ? messages.episodes.minutes(props.episode.runtime) : null,
  ]
    .filter(Boolean)
    .join(' · '),
);
const times = computed(() => props.episode.viewings.length);
</script>

<template>
  <li class="episode" :class="{ unaired: !aired, watched: episode.watched }">
    <div class="line">
      <button
        type="button"
        class="check"
        :class="{ on: episode.watched }"
        :disabled="busy || (!aired && !episode.watched)"
        :aria-pressed="episode.watched"
        :aria-label="
          episode.watched
            ? messages.episodes.unmarkWatched(name)
            : messages.episodes.markWatched(name)
        "
        @click="emit('toggle')"
      >
        <AppIcon v-if="episode.watched" name="check" :size="18" />
      </button>
      <button
        type="button"
        class="text"
        :aria-expanded="open"
        :aria-label="messages.episodes.details(name)"
        @click="open = !open"
      >
        <span class="name">
          <span class="number">{{ episode.number }}</span>
          <span class="title">{{ name }}</span>
          <span v-if="times > 1" class="times" :title="messages.episodes.watchedTimes(times)"
            >&times;{{ times }}</span
          >
        </span>
        <span v-if="meta || !aired" class="meta muted">
          {{ meta }}<template v-if="!aired"> · {{ messages.episodes.unaired }}</template>
        </span>
      </button>
    </div>
    <div v-if="open" class="body">
      <p class="overview" :class="{ muted: !episode.overview }">
        {{ episode.overview ?? messages.episodes.noOverview }}
      </p>
      <div v-if="aired" class="row">
        <button type="button" class="small" :disabled="busy" @click="emit('markUpTo', true)">
          {{ messages.episodes.markUpTo }}
        </button>
        <button type="button" class="small ghost" :disabled="busy" @click="emit('markUpTo', false)">
          {{ messages.episodes.markUpToUndated }}
        </button>
      </div>
      <EpisodeViewings
        v-if="episode.watched"
        :viewings="episode.viewings"
        :busy="busy"
        @change="emit('viewings', $event)"
      />
    </div>
  </li>
</template>

<style scoped>
.episode {
  border-top: 1px solid var(--outline);
}

.episode:first-child {
  border-top: 0;
}

.line {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.unaired .line {
  opacity: 0.5;
}

.check {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--outline-strong);
  border-radius: 50%;
  background: transparent;
  color: var(--on-primary, var(--surface));
}

.check.on {
  border-color: var(--primary);
  background: var(--primary);
}

.text {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  padding: var(--s-2) 0;
  border: 0;
  background: transparent;
  color: var(--on-surface);
  text-align: left;
}

.name {
  display: flex;
  align-items: baseline;
  gap: var(--s-2);
  max-width: 100%;
}

.number {
  flex: none;
  min-width: 1.5em;
  color: var(--muted);
  font-size: var(--t-label);
  font-variant-numeric: tabular-nums;
}

.title {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.times {
  flex: none;
  color: var(--primary);
  font-size: var(--t-label);
  font-weight: 600;
}

.meta {
  padding-left: calc(1.5em + var(--s-2));
  font-size: var(--t-label);
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: 0 0 var(--s-3) calc(36px + var(--s-3));
}

.overview {
  margin: 0;
  font-size: var(--t-small);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
</style>
