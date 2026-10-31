<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Season } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';
import PendingBadge from './PendingBadge.vue';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{ seriesId: number; seasons: Season[] }>();
const emit = defineEmits<{ changed: [] }>();

const api = useApi();
const number = ref('');
const error = ref<unknown>(null);
const busy = ref(false);
const nextNumber = computed(() =>
  String(props.seasons.reduce((max, season) => Math.max(max, season.number), 0) + 1),
);

function label(season: Season): string {
  return season.title
    ? `${season.number}. ${season.title}`
    : `${messages.typeLabels.season} ${season.number}`;
}

async function add(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await api.create('seasons', {
      seriesId: props.seriesId,
      number: Number(number.value || nextNumber.value),
    });
    number.value = '';
    emit('changed');
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="panel">
    <h2>{{ messages.detail.sectionSeasons }}</h2>
    <p v-if="seasons.length === 1" class="muted">{{ messages.detail.singleSeasonNote }}</p>
    <p v-if="seasons.length === 0" class="muted">{{ messages.detail.noSeasons }}</p>
    <ul class="seasons">
      <li v-for="season in seasons" :key="season.id">
        <RouterLink :to="`/seasons/${season.id}`">{{ label(season) }}</RouterLink>
        <span class="row">
          <span v-if="season.rating !== null" class="muted">{{ season.rating }}</span>
          <StatusBadge :status="season.status" />
          <PendingBadge v-if="season.pendingReview" />
        </span>
      </li>
    </ul>
    <form class="row" @submit.prevent="add">
      <input
        v-model="number"
        type="number"
        min="0"
        step="1"
        class="number"
        :placeholder="nextNumber"
        :aria-label="messages.detail.seasonNumber"
      />
      <button type="submit" :disabled="busy">{{ messages.detail.addSeason }}</button>
    </form>
    <ErrorNotice :error="error" />
  </section>
</template>

<style scoped>
.seasons {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}

.seasons li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--outline);
}

.number {
  width: 110px;
}
</style>
