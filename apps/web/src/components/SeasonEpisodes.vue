<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { normalizeViewings } from '@metrack/domain';
import type {
  EpisodeOperation,
  MediaStatus,
  Season,
  SeasonEpisodesResponse,
  SeasonEpisodesUpdateResponse,
  Viewing,
} from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import {
  doneOrSkipped,
  isDone,
  openRewatchStart,
  unwatchedAired,
  watchedTodayKeys,
} from '../logic/episodeSelection';
import { inverseOperations } from '../logic/inverseOperations';
import { todayIso } from '../logic/todayIso';
import EpisodeRow from './EpisodeRow.vue';
import ErrorNotice from './ErrorNotice.vue';
import SeasonProgress from './SeasonProgress.vue';
import UndoToast from './UndoToast.vue';

const TOAST_MS = 7000;
const REFILL_MS = 1500;
const REFILL_ATTEMPTS = 20;

const props = defineProps<{
  seasonId: number;
  seriesId: number;
  status: MediaStatus;
  rewatches?: Viewing[];
}>();
const emit = defineEmits<{
  updated: [update: SeasonEpisodesUpdateResponse];
  loaded: [data: SeasonEpisodesResponse];
  saved: [season: Season];
}>();

const api = useApi();
const data = ref<SeasonEpisodesResponse | null>(null);
const busy = ref(false);
const error = ref<unknown>(null);
const toast = ref<{ message: string; undo: EpisodeOperation[] } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let ticket = 0;
let refill: ReturnType<typeof setTimeout> | undefined;
const attempts = ref(0);

const today = computed(() => todayIso());
const numbered = computed(() => data.value?.source !== 'numbers');
const partial = computed(() => data.value !== null && !data.value.complete);
const stalled = computed(() => partial.value && attempts.value >= REFILL_ATTEMPTS);
const rewatchStart = computed(() => openRewatchStart(props.rewatches ?? []));
const markable = computed(() =>
  data.value ? watchedTodayKeys(data.value.episodes, today.value, rewatchStart.value) : [],
);
const progress = computed(() =>
  data.value
    ? rewatchStart.value === null
      ? data.value.watchedCount + data.value.skippedCount
      : doneOrSkipped(data.value.episodes, rewatchStart.value)
    : 0,
);
const canRewatch = computed(
  () =>
    numbered.value &&
    props.status === 'completed' &&
    rewatchStart.value === null &&
    props.rewatches !== undefined,
);

function stopRefill(): void {
  clearTimeout(refill);
  refill = undefined;
}

function planRefill(mine: number): void {
  stopRefill();
  if (mine !== ticket || !data.value || data.value.complete || attempts.value >= REFILL_ATTEMPTS)
    return;
  refill = setTimeout(() => void refillOnce(mine), REFILL_MS);
}

async function refillOnce(mine: number): Promise<void> {
  refill = undefined;
  if (mine !== ticket) return;
  if (busy.value) return planRefill(mine);
  attempts.value += 1;
  try {
    const loaded = await api.seasonEpisodes(props.seasonId);
    if (mine === ticket && !busy.value) data.value = loaded;
  } catch {
    /* the next attempt asks again */
  }
  planRefill(mine);
}

async function load(): Promise<void> {
  const mine = ++ticket;
  stopRefill();
  attempts.value = 0;
  data.value = null;
  error.value = null;
  dismiss();
  try {
    const loaded = await api.seasonEpisodes(props.seasonId);
    if (mine !== ticket) return;
    data.value = loaded;
    emit('loaded', loaded);
    planRefill(mine);
  } catch (cause) {
    if (mine === ticket) error.value = cause;
  }
}

function say(message: string, undo: EpisodeOperation[]): void {
  clearTimeout(timer);
  toast.value = { message, undo };
  timer = setTimeout(dismiss, TOAST_MS);
}

function dismiss(): void {
  clearTimeout(timer);
  toast.value = null;
}

function receive(update: SeasonEpisodesUpdateResponse): void {
  data.value = update;
  emit('updated', update);
  planRefill(ticket);
}

async function run(
  operation: EpisodeOperation,
  describe: (changedStatus: MediaStatus | null) => string,
): Promise<void> {
  if (busy.value || !data.value) return;
  busy.value = true;
  error.value = null;
  try {
    const undo = inverseOperations(operation, data.value.episodes);
    const before = props.status;
    const update = await api.updateSeasonEpisodes(props.seasonId, operation);
    receive(update);
    say(describe(update.tracking.status !== before ? update.tracking.status : null), undo);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

function marked(count: number): (changed: MediaStatus | null) => string {
  return (changed) =>
    changed
      ? `${messages.episodes.marked(count)}. ${messages.episodes.statusChanged(messages.statusLabels[changed])}`
      : messages.episodes.marked(count);
}

function mark(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    say(messages.episodes.nothingToMark, []);
    return Promise.resolve();
  }
  return run({ op: 'mark', keys, date: today.value }, marked(keys.length));
}

function toggle(key: string): Promise<void> {
  const episode = data.value?.episodes.find((e) => e.key === key);
  if (!episode || !isDone(episode, rewatchStart.value)) return mark([key]);
  if (rewatchStart.value === null) {
    return run({ op: 'unmark', keys: [key] }, () => messages.episodes.unmarked);
  }
  const start = rewatchStart.value;
  const kept = episode.viewings.filter(
    (viewing) => viewing.finishedAt !== null && viewing.finishedAt < start,
  );
  return kept.length === 0
    ? run({ op: 'unmark', keys: [key] }, () => messages.episodes.unmarked)
    : run({ op: 'setViewings', key, viewings: kept }, () => messages.episodes.unmarked);
}

function markUpTo(key: string): Promise<void> {
  return data.value
    ? mark(unwatchedAired(data.value.episodes, today.value, key, rewatchStart.value))
    : Promise.resolve();
}

function skip(key: string): Promise<void> {
  return run({ op: 'skip', keys: [key] }, () => messages.episodes.skipped(1));
}

function unskip(key: string): Promise<void> {
  return run({ op: 'unskip', keys: [key] }, () => messages.episodes.unskipped);
}

async function startRewatch(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    const next = normalizeViewings([
      ...(props.rewatches ?? []),
      { startedAt: today.value, finishedAt: null },
    ]);
    const updated = await api.patch('seasons', props.seasonId, { rewatches: next } as never);
    emit('saved', updated as unknown as Season);
    say(messages.episodes.rewatchStarted, []);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

function setViewings(key: string, viewings: Viewing[]): Promise<void> {
  return run({ op: 'setViewings', key, viewings }, () => messages.episodes.viewingsSaved);
}

async function undo(): Promise<void> {
  const operations = toast.value?.undo ?? [];
  dismiss();
  if (busy.value || operations.length === 0) return;
  busy.value = true;
  error.value = null;
  try {
    for (const operation of operations) {
      receive(await api.updateSeasonEpisodes(props.seasonId, operation));
    }
    say(messages.quick.undone, []);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

watch(() => props.seasonId, load, { immediate: true });
onBeforeUnmount(() => {
  clearTimeout(timer);
  stopRefill();
  ticket += 1;
});
</script>

<template>
  <section class="panel episodes" aria-labelledby="episodes-title">
    <h2 id="episodes-title">{{ messages.episodes.title }}</h2>
    <p v-if="!data && !error" class="muted">{{ messages.episodes.loading }}</p>
    <ErrorNotice :error="error" />
    <template v-if="data">
      <SeasonProgress
        :watched="progress"
        :total="data.episodeCount"
        :skipped="rewatchStart === null ? data.skippedCount : 0"
        :rewatch="rewatchStart !== null"
      />
      <p v-if="partial" class="muted partial" role="status">
        {{ stalled ? messages.episodes.partialStalled : messages.episodes.partial }}
      </p>
      <p v-if="data.episodes.length === 0" class="muted">{{ messages.episodes.empty }}</p>
      <template v-else>
        <div class="row actions">
          <button
            type="button"
            class="small"
            :disabled="busy || markable.length === 0"
            @click="mark(markable)"
          >
            {{ messages.episodes.watchedToday }}
          </button>
          <button
            v-if="canRewatch"
            type="button"
            class="small ghost"
            :disabled="busy"
            @click="startRewatch"
          >
            {{ messages.episodes.rewatch }}
          </button>
        </div>
        <ul class="list">
          <EpisodeRow
            v-for="episode in data.episodes"
            :key="episode.key"
            :episode="episode"
            :numbered="numbered"
            :today="today"
            :busy="busy"
            :rewatch-start="rewatchStart"
            @toggle="toggle(episode.key)"
            @mark-up-to="markUpTo(episode.key)"
            @skip="skip(episode.key)"
            @unskip="unskip(episode.key)"
            @viewings="setViewings(episode.key, $event)"
          />
        </ul>
      </template>
    </template>
    <Teleport to="body">
      <UndoToast
        v-if="toast"
        :message="toast.message"
        :undoable="toast.undo.length > 0"
        @undo="undo"
        @dismiss="dismiss"
      />
    </Teleport>
  </section>
</template>

<style scoped>
.episodes {
  margin-bottom: var(--s-7);
}

.actions {
  margin: var(--s-3) 0;
}

.list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.partial {
  margin: var(--s-3) 0;
}
</style>
