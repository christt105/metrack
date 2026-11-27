<script setup lang="ts">
import { computed, ref } from 'vue';
import { openRewatchStart, pickNextSeason } from '@metrack/domain';
import type { Season } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import { todayIso } from '../logic/todayIso';
import ErrorNotice from './ErrorNotice.vue';

const messages = useMessages();
const api = useApi();
const props = defineProps<{ seasons: Season[] }>();
const emit = defineEmits<{ changed: [] }>();

const busy = ref(false);
const error = ref<unknown>(null);

const first = computed(() => {
  const regular = props.seasons.filter((season) => season.number !== 0);
  const done =
    regular.length > 0 &&
    regular.every((season) => season.status === 'completed') &&
    pickNextSeason(props.seasons, todayIso()) === null;
  if (!done) return undefined;
  const season = [...regular].sort((a, b) => a.number - b.number)[0];
  return season && !season.wantsRewatch && openRewatchStart(season.rewatches) === null
    ? season
    : undefined;
});

async function start(): Promise<void> {
  const season = first.value;
  if (!season || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    await api.seasons.setSeasonRewatchIntent(season.id, true);
    emit('changed');
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section v-if="first" class="panel restart" aria-labelledby="restart-series-title">
    <h2 id="restart-series-title">{{ messages.episodes.restartSeries }}</h2>
    <p class="muted">{{ messages.episodes.restartSeriesHint }}</p>
    <ErrorNotice :error="error" />
    <button type="button" class="small" :disabled="busy" @click="start">
      {{ messages.episodes.restartSeries }}
    </button>
  </section>
</template>

<style scoped>
.restart {
  margin-bottom: var(--s-7);
}
</style>
