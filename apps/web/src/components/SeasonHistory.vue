<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SeasonEpisodeItem, Viewing } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';
import type { HistoryPass } from '../logic/HistoryPass';
import type { HistoryRow } from '../logic/HistoryRow';
import { seasonHistory } from '../logic/seasonHistory';
import ViewingRow from './ViewingRow.vue';

const messages = useMessages();
const props = defineProps<{
  episodes: readonly SeasonEpisodeItem[];
  wantsRewatch: boolean;
  busy: boolean;
}>();
const emit = defineEmits<{
  change: [row: HistoryRow, replacement: Viewing];
  remove: [row: HistoryRow];
  deletePass: [pass: HistoryPass];
  takeBack: [pass: HistoryPass];
  removeIntent: [];
}>();

const history = computed(() => seasonHistory(props.episodes));
const total = computed(() => props.episodes.filter((episode) => !episode.skipped).length);
const asking = ref<string | null>(null);
const empty = computed(
  () => history.value.passes.length === 0 && history.value.abandoned.length === 0,
);

function name(pass: HistoryPass): string {
  if (pass.abandonedOn !== null)
    return messages.history.leftBehind(messages.episodes.airDate(pass.abandonedOn));
  return pass.number === 1
    ? messages.history.firstTime
    : messages.history.rewatchN((pass.number ?? 1) - 1);
}

function range(pass: HistoryPass): string {
  const date = (value: string | null) => (value === null ? null : messages.episodes.airDate(value));
  return messages.history.range(date(pass.startedAt), date(pass.finishedAt));
}

function label(row: HistoryRow): string {
  return `${row.number}. ${row.title ?? messages.episodes.episode(row.number)}`;
}

function confirmDelete(pass: HistoryPass): void {
  asking.value = null;
  emit('deletePass', pass);
}

const passId = (pass: HistoryPass) => pass.abandonedOn ?? `pass-${pass.number}`;
const asked = (pass: HistoryPass) => asking.value === passId(pass);
</script>

<template>
  <section class="panel history" aria-labelledby="history-title">
    <h2 id="history-title">{{ messages.history.title }}</h2>
    <p class="muted intro">{{ messages.history.intro }}</p>
    <div v-if="wantsRewatch" class="intent">
      <span>{{ messages.history.wantsRewatch }}</span>
      <button type="button" class="small ghost" :disabled="busy" @click="emit('removeIntent')">
        {{ messages.history.removeIntent }}
      </button>
    </div>
    <p v-if="empty" class="muted">{{ messages.history.empty }}</p>
    <details
      v-for="pass in [...history.passes, ...history.abandoned]"
      :key="passId(pass)"
      class="pass"
      :class="{ left: pass.abandonedOn !== null }"
    >
      <summary>
        <span class="name">{{ name(pass) }}</span>
        <span class="meta muted"
          >{{ messages.history.summary(pass.rows.length, total) }} · {{ range(pass) }}</span
        >
      </summary>
      <ul class="rows">
        <ViewingRow
          v-for="row in pass.rows"
          :key="`${row.key}|${row.viewing.startedAt}|${row.viewing.finishedAt}`"
          :viewing="row.viewing"
          :label="label(row)"
          :busy="busy"
          :removable="pass.abandonedOn === null"
          single
          @change="emit('change', row, $event)"
          @remove="emit('remove', row)"
        />
      </ul>
      <div v-if="pass.abandonedOn !== null" class="pass-actions">
        <p class="muted hint">{{ messages.history.takeBackHint }}</p>
        <button type="button" class="small" :disabled="busy" @click="emit('takeBack', pass)">
          {{ messages.history.takeBack }}
        </button>
      </div>
      <div v-else-if="!asked(pass)" class="pass-actions">
        <button type="button" class="small danger" :disabled="busy" @click="asking = passId(pass)">
          {{ messages.history.deletePass }}
        </button>
      </div>
      <div v-else class="warning" role="alertdialog">
        <p>{{ messages.history.deletePassWarning(name(pass)) }}</p>
        <div class="row">
          <button type="button" class="small danger" :disabled="busy" @click="confirmDelete(pass)">
            {{ messages.history.confirmDelete }}
          </button>
          <button type="button" class="small ghost" @click="asking = null">
            {{ messages.common.cancel }}
          </button>
        </div>
      </div>
    </details>
  </section>
</template>

<style scoped>
.history {
  margin-bottom: var(--s-7);
}

.intro {
  margin: 0 0 var(--s-3);
}

.intent {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
}

.pass {
  border-top: 1px solid var(--outline);
}

summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  min-height: 44px;
  padding: var(--s-2) 0;
  cursor: pointer;
}

.name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.meta {
  font-size: var(--t-small);
}

.left .name {
  color: var(--muted);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  margin: 0 0 var(--s-3);
  list-style: none;
}

.pass-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
  padding-bottom: var(--s-3);
}

.hint {
  flex: 1 1 200px;
  margin: 0;
  font-size: var(--t-small);
}

.warning {
  padding-bottom: var(--s-3);
}

.warning p {
  margin: 0 0 var(--s-2);
  overflow-wrap: anywhere;
}
</style>
