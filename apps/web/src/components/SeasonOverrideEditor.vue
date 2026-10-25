<script setup lang="ts">
import { ref } from 'vue';
import type { SeasonOverride } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ seriesId: number; overrides: SeasonOverride[] }>();
const emit = defineEmits<{ changed: [] }>();

const api = useApi();
const tmdbSeason = ref('');
const number = ref('');
const title = ref('');
const jellyfinSeasonId = ref('');
const error = ref<unknown>(null);
const busy = ref(false);

function edit(override: SeasonOverride): void {
  tmdbSeason.value = String(override.tmdbSeasonNumber);
  number.value = override.number === null ? '' : String(override.number);
  title.value = override.title ?? '';
  jellyfinSeasonId.value = override.jellyfinSeasonId ?? '';
}

async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await action();
    emit('changed');
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

const save = () =>
  run(async () => {
    await api.putOverride(props.seriesId, Number(tmdbSeason.value), {
      number: number.value === '' ? null : Number(number.value),
      title: title.value.trim() || null,
      jellyfinSeasonId: jellyfinSeasonId.value.trim() || null,
    });
    tmdbSeason.value = number.value = title.value = jellyfinSeasonId.value = '';
  });

const remove = (override: SeasonOverride) =>
  run(() => api.deleteOverride(props.seriesId, override.tmdbSeasonNumber));
</script>

<template>
  <section class="panel">
    <h2>{{ messages.detail.sectionOverrides }}</h2>
    <p class="muted">{{ messages.overrides.description }}</p>
    <p v-if="overrides.length === 0" class="muted">{{ messages.overrides.empty }}</p>
    <ul class="list">
      <li v-for="override in overrides" :key="override.tmdbSeasonNumber">
        <button type="button" class="link" @click="edit(override)">
          {{ messages.overrides.tmdbSeasonNumber }} {{ override.tmdbSeasonNumber }}
        </button>
        <span class="muted">
          {{ override.number !== null ? `#${override.number}` : '' }} {{ override.title ?? '' }}
          {{ override.jellyfinSeasonId ?? '' }}
        </span>
        <button type="button" class="small danger" :disabled="busy" @click="remove(override)">
          {{ messages.common.remove }}
        </button>
      </li>
    </ul>
    <form class="form" @submit.prevent="save">
      <label>
        <span class="muted">{{ messages.overrides.tmdbSeasonNumber }}</span>
        <input v-model="tmdbSeason" type="number" min="0" step="1" required />
      </label>
      <label>
        <span class="muted">{{ messages.overrides.number }}</span>
        <input v-model="number" type="number" min="0" step="1" />
      </label>
      <label>
        <span class="muted">{{ messages.overrides.title }}</span>
        <input v-model="title" type="text" />
      </label>
      <label>
        <span class="muted">{{ messages.overrides.jellyfinSeasonId }}</span>
        <input v-model="jellyfinSeasonId" type="text" />
      </label>
      <button type="submit" :disabled="busy">{{ messages.overrides.save }}</button>
    </form>
    <ErrorNotice :error="error" />
  </section>
</template>

<style scoped>
.list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}

.list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.link {
  min-height: 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary);
}

.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: end;
}

label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}

@media (min-width: 760px) {
  .form {
    grid-template-columns: repeat(4, 1fr) auto;
  }
}
</style>
