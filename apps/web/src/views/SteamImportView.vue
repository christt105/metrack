<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SteamApplyOutcome, SteamImportReport, SteamImportRow } from '@metrack/domain';
import ErrorNotice from '../components/ErrorNotice.vue';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import { applySteamRows } from '../logic/applySteamRows';
import { prepareSteamArtwork } from '../logic/prepareSteamArtwork';
import { formatDuration } from '../logic/formatDuration';
import type { SteamApplyProgress } from '../logic/SteamApplyProgress';
import type { SteamApplyTally } from '../logic/SteamApplyTally';

const messages = useMessages();
const api = useApi();

const report = ref<SteamImportReport | null>(null);
const selected = ref(new Set<string>());
const error = ref<unknown>(null);
const checking = ref(false);
const progress = ref<SteamApplyProgress | null>(null);
const result = ref<SteamApplyTally | null>(null);
const artworkLeft = ref<number | null>(null);
const importing = computed(() => progress.value !== null || artworkLeft.value !== null);

const rows = computed(() => report.value?.rows ?? []);
const neverPlayed = computed(() => rows.value.filter((row) => row.playtimeMinutes === 0));
const includeNeverPlayed = computed(
  () =>
    neverPlayed.value.length > 0 && neverPlayed.value.every((row) => selected.value.has(row.appId)),
);

async function check(): Promise<void> {
  checking.value = true;
  error.value = null;
  result.value = null;
  try {
    const loaded = await api.steamReport();
    report.value = loaded;
    selected.value = new Set(loaded.rows.filter((row) => row.selected).map((row) => row.appId));
  } catch (cause) {
    report.value = null;
    error.value = cause;
  } finally {
    checking.value = false;
  }
}

function toggle(row: SteamImportRow): void {
  const next = new Set(selected.value);
  if (!next.delete(row.appId)) next.add(row.appId);
  selected.value = next;
}

const selectAll = () => (selected.value = new Set(rows.value.map((row) => row.appId)));
const selectNone = () => (selected.value = new Set());

function setNeverPlayed(event: Event): void {
  const next = new Set(selected.value);
  const on = (event.target as HTMLInputElement).checked;
  for (const row of neverPlayed.value) {
    if (on) next.add(row.appId);
    else next.delete(row.appId);
  }
  selected.value = next;
}

async function importSelected(): Promise<void> {
  const appIds = rows.value.filter((row) => selected.value.has(row.appId)).map((row) => row.appId);
  error.value = null;
  result.value = null;
  progress.value = { done: 0, total: appIds.length };
  try {
    result.value = await applySteamRows(
      appIds,
      (batch) => api.applySteam(batch),
      (next) => (progress.value = next),
    );
  } catch (cause) {
    error.value = cause;
  } finally {
    progress.value = null;
  }
  const imported = result.value?.imported ?? 0;
  if (imported === 0) return;
  artworkLeft.value = imported;
  try {
    await prepareSteamArtwork(
      () => api.prepareSteamArtwork(),
      (left) => (artworkLeft.value = left),
    );
  } catch (cause) {
    error.value = cause;
  } finally {
    artworkLeft.value = null;
  }
}

const nameOf = (outcome: SteamApplyOutcome): string =>
  report.value?.rows.find((row) => row.appId === outcome.appId)?.name ?? outcome.appId;

const lastPlayed = (row: SteamImportRow): string =>
  row.lastPlayedAt === null ? '' : row.lastPlayedAt.slice(0, 10);
</script>

<template>
  <section>
    <h1>{{ messages.steam.importTitle }}</h1>
    <p class="muted">{{ messages.steam.importHint }}</p>
    <p class="muted">{{ messages.steam.privacy }}</p>
    <button type="button" :disabled="checking || importing" data-test="steam-check" @click="check">
      {{ messages.steam.check }}
    </button>
    <ErrorNotice :error="error" />
    <p v-if="checking" class="muted">{{ messages.common.loading }}</p>

    <template v-if="report">
      <p data-test="steam-summary">
        {{
          messages.steam.summary(
            report.owned,
            rows.length,
            report.upToDate,
            report.unmatched.length,
          )
        }}
      </p>
      <template v-if="rows.length > 0">
        <div class="actions">
          <button type="button" :disabled="importing" data-test="steam-all" @click="selectAll">
            {{ messages.steam.selectAll }}
          </button>
          <button type="button" :disabled="importing" data-test="steam-none" @click="selectNone">
            {{ messages.steam.selectNone }}
          </button>
          <label v-if="neverPlayed.length > 0">
            <input
              type="checkbox"
              data-test="steam-never-played"
              :checked="includeNeverPlayed"
              :disabled="importing"
              @change="setNeverPlayed"
            />
            {{ messages.steam.includeNeverPlayed(neverPlayed.length) }}
          </label>
        </div>
        <table data-test="steam-rows">
          <thead>
            <tr>
              <th></th>
              <th>{{ messages.steam.game }}</th>
              <th>{{ messages.steam.time }}</th>
              <th>{{ messages.steam.lastPlayed }}</th>
              <th>{{ messages.steam.proposal }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.appId" :data-test="`steam-row-${row.appId}`">
              <td>
                <input
                  type="checkbox"
                  :checked="selected.has(row.appId)"
                  :disabled="importing"
                  :aria-label="row.name"
                  @change="toggle(row)"
                />
              </td>
              <td>{{ row.name }}</td>
              <td>
                <template v-if="row.action === 'update'">
                  {{ formatDuration(row.storedMinutes ?? 0) }} &rarr;
                  {{ formatDuration(row.playtimeMinutes) }}
                </template>
                <template v-else>{{ formatDuration(row.playtimeMinutes) }}</template>
              </td>
              <td>{{ lastPlayed(row) }}</td>
              <td>
                <template v-if="row.action === 'update'">{{ messages.steam.updateTime }}</template>
                <template v-else-if="row.status">
                  {{ messages.steam.importAs(messages.statusLabels[row.status]) }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
        <button
          type="button"
          :disabled="importing || selected.size === 0"
          data-test="steam-import"
          @click="importSelected"
        >
          {{ messages.steam.importSelected(selected.size) }}
        </button>
      </template>
      <details v-if="report.unmatched.length > 0" data-test="steam-unmatched">
        <summary>{{ messages.steam.unmatched(report.unmatched.length) }}</summary>
        <p class="muted">{{ messages.steam.unmatchedHint }}</p>
        <ul>
          <li v-for="game in report.unmatched" :key="game.appId">
            {{ game.name }} ({{ formatDuration(game.playtimeMinutes) }})
          </li>
        </ul>
      </details>
    </template>

    <div v-if="progress" data-test="steam-progress">
      <progress :value="progress.done" :max="progress.total"></progress>
      <span class="muted">{{ messages.steam.progress(progress.done, progress.total) }}</span>
    </div>

    <p v-if="artworkLeft !== null" class="muted" data-test="steam-artwork">
      {{ messages.steam.artwork(artworkLeft) }}
    </p>

    <div v-if="result" data-test="steam-result">
      <p>{{ messages.steam.done(result.imported, result.updated, result.skipped) }}</p>
      <template v-if="result.failed.length > 0">
        <p>{{ messages.steam.failed(result.failed.length) }}</p>
        <ul>
          <li v-for="outcome in result.failed" :key="outcome.appId">
            {{ nameOf(outcome) }}: {{ outcome.error }}
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin: 0.75rem 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75rem;
}
th,
td {
  text-align: left;
  padding: 0.25rem 0.5rem;
}
progress {
  width: 100%;
}
</style>
