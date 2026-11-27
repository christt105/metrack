<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { isDone, openRewatchStart, unwatchedAired } from '@metrack/domain';
import type {
  EpisodeOperation,
  MediaStatus,
  SeasonEpisodesResponse,
  SeasonEpisodesUpdateResponse,
  Viewing,
} from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import { doneOrSkipped, watchedTodayKeys } from '../logic/episodeSelection';
import type { HistoryPass } from '../logic/HistoryPass';
import type { HistoryRow } from '../logic/HistoryRow';
import { changeViewing, deleteViewing } from '../logic/historyOperations';
import { inverseOperations } from '../logic/inverseOperations';
import { todayIso } from '../logic/todayIso';
import EpisodeRow from './EpisodeRow.vue';
import ErrorNotice from './ErrorNotice.vue';
import SeasonHistory from './SeasonHistory.vue';
import SeasonProgress from './SeasonProgress.vue';
import UndoToast from './UndoToast.vue';

const messages = useMessages();
const TOAST_MS = 7000;
const REFILL_MS = 1500;
const REFILL_ATTEMPTS = 20;

const props = defineProps<{
  seasonId: number;
  seriesId: number;
  status: MediaStatus;
  rewatches?: Viewing[];
  wantsRewatch?: boolean;
}>();
const emit = defineEmits<{
  updated: [update: SeasonEpisodesUpdateResponse];
  loaded: [data: SeasonEpisodesResponse];
}>();

const api = useApi();
const data = ref<SeasonEpisodesResponse | null>(null);
const busy = ref(false);
const error = ref<unknown>(null);
const toast = ref<{
  message: string;
  undo: EpisodeOperation[];
  restart: boolean;
  intent: boolean | null;
} | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let ticket = 0;
let refill: ReturnType<typeof setTimeout> | undefined;
const attempts = ref(0);

const today = computed(() => todayIso());
const numbered = computed(() => data.value?.source !== 'numbers');
const partial = computed(() => data.value !== null && !data.value.complete);
const stalled = computed(() => partial.value && attempts.value >= REFILL_ATTEMPTS);
const wanted = computed(() => props.status === 'completed' && props.wantsRewatch === true);
const openStart = computed(() => openRewatchStart(props.rewatches ?? []));
const rewatchStart = computed(() => openStart.value ?? (wanted.value ? today.value : null));
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
const canRestart = computed(
  () =>
    numbered.value &&
    (props.status === 'in_progress' || openStart.value !== null) &&
    (data.value?.episodes.some((episode) => isDone(episode, rewatchStart.value)) ?? false),
);
const canCancelRewatch = computed(() => wanted.value && openStart.value === null);

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
    const loaded = await api.seasons.seasonEpisodes(props.seasonId);
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
    const loaded = await api.seasons.seasonEpisodes(props.seasonId);
    if (mine !== ticket) return;
    data.value = loaded;
    emit('loaded', loaded);
    planRefill(mine);
  } catch (cause) {
    if (mine === ticket) error.value = cause;
  }
}

function say(
  message: string,
  undo: EpisodeOperation[],
  restart = false,
  intent: boolean | null = null,
): void {
  clearTimeout(timer);
  toast.value = { message, undo, restart, intent };
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
    const update = await api.seasons.updateSeasonEpisodes(props.seasonId, operation);
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
    (viewing) =>
      viewing.abandonedAt !== undefined ||
      (viewing.finishedAt !== null && viewing.finishedAt < start),
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

async function setRewatchIntent(wantedNow: boolean): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    receive(await api.seasons.setSeasonRewatchIntent(props.seasonId, wantedNow));
    say(wantedNow ? messages.episodes.rewatchStarted : messages.episodes.rewatchCancelled, []);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

async function restart(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    receive(await api.seasons.restartSeason(props.seasonId));
    say(messages.episodes.restartDone, [], true);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

function setViewings(key: string, viewings: Viewing[]): Promise<void> {
  return run({ op: 'setViewings', key, viewings }, () => messages.episodes.viewingsSaved);
}

function changeRow(row: HistoryRow, replacement: Viewing): Promise<void> {
  return run(changeViewing(row, replacement), () => messages.history.viewingChanged);
}

function removeRow(row: HistoryRow): Promise<void> {
  return run(deleteViewing(row), () => messages.history.viewingDeleted);
}

function previousViewings(rows: readonly HistoryRow[]): EpisodeOperation[] {
  const keys = new Set(rows.map((row) => row.key));
  const episodes = (data.value?.episodes ?? [])
    .filter((episode) => keys.has(episode.key))
    .map(({ key, viewings }) => ({ key, viewings }));
  return episodes.length === 0 ? [] : [{ op: 'restoreViewings', episodes }];
}

async function deletePass(pass: HistoryPass): Promise<void> {
  if (busy.value || pass.number === null) return;
  busy.value = true;
  error.value = null;
  try {
    const undo = previousViewings(pass.rows);
    receive(await api.seasons.removeSeasonPass(props.seasonId, pass.number));
    say(messages.history.passDeleted, undo);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

async function takeBack(pass: HistoryPass): Promise<void> {
  if (busy.value || pass.abandonedOn === null) return;
  busy.value = true;
  error.value = null;
  try {
    const undo = previousViewings(pass.rows);
    receive(await api.seasons.undoSeasonRestart(props.seasonId, pass.abandonedOn));
    say(messages.history.startOverUndone, undo);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

async function removeIntent(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    receive(await api.seasons.setSeasonRewatchIntent(props.seasonId, false));
    say(messages.history.intentRemoved, [], false, true);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

async function undo(): Promise<void> {
  const operations = toast.value?.undo ?? [];
  const restarted = toast.value?.restart ?? false;
  const intent = toast.value?.intent ?? null;
  dismiss();
  if (busy.value || (operations.length === 0 && !restarted && intent === null)) return;
  busy.value = true;
  error.value = null;
  try {
    if (intent !== null) receive(await api.seasons.setSeasonRewatchIntent(props.seasonId, intent));
    if (restarted) receive(await api.seasons.undoSeasonRestart(props.seasonId));
    for (const operation of operations) {
      receive(await api.seasons.updateSeasonEpisodes(props.seasonId, operation));
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
            @click="setRewatchIntent(true)"
          >
            {{ messages.episodes.rewatch }}
          </button>
          <button
            v-if="canRestart"
            type="button"
            class="small ghost"
            :disabled="busy"
            @click="restart"
          >
            {{ messages.episodes.restart }}
          </button>
          <button
            v-if="canCancelRewatch"
            type="button"
            class="small ghost"
            :disabled="busy"
            @click="setRewatchIntent(false)"
          >
            {{ messages.episodes.rewatchCancel }}
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
  </section>
  <SeasonHistory
    v-if="data && numbered"
    :episodes="data.episodes"
    :wants-rewatch="props.wantsRewatch === true"
    :busy="busy"
    @change="changeRow"
    @remove="removeRow"
    @delete-pass="deletePass"
    @take-back="takeBack"
    @remove-intent="removeIntent"
  />
  <Teleport to="body">
    <UndoToast
      v-if="toast"
      :message="toast.message"
      :undoable="toast.undo.length > 0 || toast.restart || toast.intent !== null"
      @undo="undo"
      @dismiss="dismiss"
    />
  </Teleport>
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
