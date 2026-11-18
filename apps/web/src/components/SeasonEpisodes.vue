<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type {
  EpisodeOperation,
  MediaStatus,
  SeasonEpisodesResponse,
  SeasonEpisodesUpdateResponse,
  Viewing,
} from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import { unwatchedAired } from '../logic/episodeSelection';
import { inverseOperations } from '../logic/inverseOperations';
import { todayIso } from '../logic/todayIso';
import EpisodeRow from './EpisodeRow.vue';
import ErrorNotice from './ErrorNotice.vue';
import SeasonProgress from './SeasonProgress.vue';
import UndoToast from './UndoToast.vue';

const TOAST_MS = 7000;
const REFILL_MS = 1500;
const REFILL_ATTEMPTS = 20;

const props = defineProps<{ seasonId: number; seriesId: number; status: MediaStatus }>();
const emit = defineEmits<{ updated: [update: SeasonEpisodesUpdateResponse] }>();

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
const markable = computed(() =>
  data.value ? unwatchedAired(data.value.episodes, today.value) : [],
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

function mark(keys: string[], dated: boolean): Promise<void> {
  if (keys.length === 0) {
    say(messages.episodes.nothingToMark, []);
    return Promise.resolve();
  }
  return run({ op: 'mark', keys, date: dated ? today.value : null }, marked(keys.length));
}

function toggle(key: string, watched: boolean): Promise<void> {
  return watched
    ? run({ op: 'unmark', keys: [key] }, () => messages.episodes.unmarked)
    : mark([key], true);
}

function markUpTo(key: string, dated: boolean): Promise<void> {
  return data.value
    ? mark(unwatchedAired(data.value.episodes, today.value, key), dated)
    : Promise.resolve();
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
      <SeasonProgress :watched="data.watchedCount" :total="data.episodeCount" />
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
            @click="mark(markable, true)"
          >
            {{ messages.episodes.markAll }}
          </button>
          <button
            type="button"
            class="small ghost"
            :disabled="busy || markable.length === 0"
            @click="mark(markable, false)"
          >
            {{ messages.episodes.markAllUndated }}
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
            @toggle="toggle(episode.key, episode.watched)"
            @mark-up-to="markUpTo(episode.key, $event)"
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
