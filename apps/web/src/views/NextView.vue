<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { EpisodeOperation, NextEpisodeRow } from '@metrack/domain';
import ErrorNotice from '../components/ErrorNotice.vue';
import NextRow from '../components/NextRow.vue';
import UndoToast from '../components/UndoToast.vue';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import { inverseOperations } from '../logic/inverseOperations';
import { nextEpisodeKey } from '../logic/nextEpisodeKey';
import { replaceNextRow } from '../logic/replaceNextRow';
import { todayIso } from '../logic/todayIso';

const TOAST_MS = 7000;

interface Undoable {
  message: string;
  seriesId: number;
  revert: (() => Promise<void>) | null;
}

const messages = useMessages();
const api = useApi();
const rows = ref<NextEpisodeRow[] | null>(null);
const loadError = ref<unknown>(null);
const busy = ref(new Set<number>());
const error = ref<unknown>(null);
const toast = ref<Undoable | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

async function load(): Promise<void> {
  try {
    rows.value = (await api.nextEpisodes()).rows;
  } catch (cause) {
    loadError.value = cause;
  }
}

function dismiss(): void {
  clearTimeout(timer);
  toast.value = null;
}

function say(next: Undoable): void {
  clearTimeout(timer);
  toast.value = next;
  timer = setTimeout(dismiss, TOAST_MS);
}

function setBusy(seriesId: number, on: boolean): void {
  const next = new Set(busy.value);
  if (on) next.add(seriesId);
  else next.delete(seriesId);
  busy.value = next;
}

async function refreshRow(seriesId: number): Promise<void> {
  const response = await api.nextEpisodes(seriesId);
  rows.value = replaceNextRow(rows.value ?? [], seriesId, response.rows[0] ?? null);
}

async function inverseFor(
  row: NextEpisodeRow,
  operation: EpisodeOperation,
): Promise<EpisodeOperation[]> {
  if (row.source !== 'numbers' && rewatching(row)) {
    return inverseOperations(operation, (await api.seasonEpisodes(row.season.id)).episodes);
  }
  const keys = [nextEpisodeKey(row)];
  return [operation.op === 'skip' ? { op: 'unskip', keys } : { op: 'unmark', keys }];
}

const rewatching = (row: NextEpisodeRow): boolean =>
  row.progress.rewatch || row.labels.includes('rewatch');

async function act(row: NextEpisodeRow, kind: 'mark' | 'skip'): Promise<void> {
  const seriesId = row.series.id;
  if (busy.value.has(seriesId) || row.availability !== 'ready') return;
  setBusy(seriesId, true);
  error.value = null;
  try {
    const keys = [nextEpisodeKey(row)];
    const operation: EpisodeOperation =
      kind === 'mark' ? { op: 'mark', keys, date: todayIso() } : { op: 'skip', keys };
    const inverse = await inverseFor(row, operation);
    const update = await api.updateSeasonEpisodes(row.season.id, operation);
    await refreshRow(seriesId);
    const done = kind === 'mark' ? messages.episodes.marked(1) : messages.episodes.skipped(1);
    const finished = update.tracking.status === 'completed' && !rewatching(row);
    say({
      message: finished ? `${done}. ${messages.next.seasonCompleted(row.season.number)}` : done,
      seriesId,
      revert: async () => {
        for (const reverse of inverse) await api.updateSeasonEpisodes(row.season.id, reverse);
        await refreshRow(seriesId);
      },
    });
  } catch (cause) {
    error.value = cause;
  } finally {
    setBusy(seriesId, false);
  }
}

async function hide(row: NextEpisodeRow): Promise<void> {
  const seriesId = row.series.id;
  if (busy.value.has(seriesId)) return;
  setBusy(seriesId, true);
  error.value = null;
  try {
    await api.hideFromNext(seriesId);
    rows.value = replaceNextRow(rows.value ?? [], seriesId, null);
    say({
      message: messages.next.hidden(row.series.title),
      seriesId,
      revert: async () => {
        await api.showInNext(seriesId);
        await load();
      },
    });
  } catch (cause) {
    error.value = cause;
  } finally {
    setBusy(seriesId, false);
  }
}

async function undo(): Promise<void> {
  const current = toast.value;
  dismiss();
  if (!current?.revert || busy.value.has(current.seriesId)) return;
  setBusy(current.seriesId, true);
  error.value = null;
  try {
    await current.revert();
    say({ ...current, message: messages.quick.undone, revert: null });
  } catch (cause) {
    error.value = cause;
  } finally {
    setBusy(current.seriesId, false);
  }
}

onMounted(load);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <section>
    <h1>{{ messages.next.title }}</h1>
    <ErrorNotice :error="loadError" />
    <ErrorNotice :error="error" />
    <p v-if="!rows && !loadError" class="muted">{{ messages.next.loading }}</p>
    <div v-else-if="rows && rows.length === 0" class="empty">
      <p class="muted">{{ messages.next.empty }}</p>
      <RouterLink to="/">{{ messages.next.emptyLink }}</RouterLink>
    </div>
    <ul v-else-if="rows" class="rows">
      <NextRow
        v-for="row in rows"
        :key="row.series.id"
        :row="row"
        :busy="busy.has(row.series.id)"
        @mark="act(row, 'mark')"
        @skip="act(row, 'skip')"
        @hide="hide(row)"
      />
    </ul>
    <Teleport to="body">
      <UndoToast
        v-if="toast"
        :message="toast.message"
        :undoable="toast.revert !== null"
        @undo="undo"
        @dismiss="dismiss"
      />
    </Teleport>
  </section>
</template>

<style scoped>
.rows {
  display: grid;
  gap: var(--s-3);
  padding: 0;
  margin: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .rows {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
