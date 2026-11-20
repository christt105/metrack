<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SeasonEpisodeItem, Viewing } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';
import { hasAired, hasDatedViewing, isDone } from '../logic/episodeSelection';
import { stillUrl } from '../logic/stillUrl';
import AppIcon from './AppIcon.vue';
import EpisodeViewings from './EpisodeViewings.vue';

const messages = useMessages();
const props = defineProps<{
  episode: SeasonEpisodeItem;
  numbered: boolean;
  today: string;
  busy: boolean;
  rewatchStart: string | null;
}>();
const emit = defineEmits<{
  toggle: [];
  markUpTo: [];
  skip: [];
  unskip: [];
  viewings: [viewings: Viewing[]];
}>();

const open = ref(false);
const stillFailed = ref(false);
const still = computed(() => (stillFailed.value ? null : stillUrl(props.episode.stillPath)));
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
const done = computed(() => isDone(props.episode, props.rewatchStart));
const skippable = computed(() => !props.episode.skipped && !hasDatedViewing(props.episode));
</script>

<template>
  <li class="episode" :class="{ unaired: !aired, watched: done, skipped: episode.skipped }">
    <div class="line">
      <button
        type="button"
        class="check"
        :class="{ on: done }"
        :disabled="busy || (!aired && !done && !episode.skipped)"
        :aria-pressed="done"
        :aria-label="
          done ? messages.episodes.unmarkWatched(name) : messages.episodes.markWatched(name)
        "
        @click="emit('toggle')"
      >
        <AppIcon v-if="done" name="check" :size="18" />
      </button>
      <img
        v-if="still"
        class="still"
        :src="still"
        :alt="messages.episodes.still(name)"
        width="80"
        height="45"
        loading="lazy"
        decoding="async"
        @error="stillFailed = true"
      />
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
          <span v-if="episode.skipped" class="skipped-label">{{
            messages.episodes.skippedLabel
          }}</span>
          <span
            v-if="times > 1 && !episode.skipped"
            class="times"
            :title="messages.episodes.watchedTimes(times)"
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
      <div class="row">
        <button v-if="aired" type="button" class="small" :disabled="busy" @click="emit('markUpTo')">
          {{ messages.episodes.markUpTo }}
        </button>
        <button
          v-if="skippable"
          type="button"
          class="small ghost"
          :disabled="busy"
          @click="emit('skip')"
        >
          <AppIcon name="skipForward" :size="16" />
          {{ messages.episodes.skip }}
        </button>
        <button
          v-else-if="episode.skipped"
          type="button"
          class="small ghost"
          :disabled="busy"
          @click="emit('unskip')"
        >
          {{ messages.episodes.unskip }}
        </button>
      </div>
      <p v-if="episode.skipped" class="muted hint">{{ messages.episodes.skippedHint }}</p>
      <EpisodeViewings
        v-if="episode.watched && !episode.skipped"
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

.skipped .line {
  opacity: 0.55;
}

.skipped .title {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.skipped-label {
  flex: none;
  padding: 1px var(--s-2);
  border: 1px solid var(--outline-strong);
  border-radius: var(--r-sm);
  color: var(--muted);
  font-size: var(--t-label);
}

.hint {
  margin: 0;
  font-size: var(--t-small);
}

.check {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  min-height: 0;
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

.still {
  flex: none;
  width: 80px;
  aspect-ratio: 16 / 9;
  height: auto;
  border-radius: var(--r-sm);
  background: var(--surface-low);
  object-fit: cover;
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
  display: -webkit-box;
  overflow: hidden;
  font-weight: 500;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow-wrap: anywhere;
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
  padding: 0 0 var(--s-3) calc(44px + var(--s-3));
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

.row .small {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
