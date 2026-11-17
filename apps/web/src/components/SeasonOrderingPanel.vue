<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import type { EpisodeGroupOptions } from '@metrack/domain';
import { sessionKey } from '../auth/sessionKey';
import { ApiRequestError } from '../api/ApiRequestError';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import { saveForAll } from '../logic/saveForAll';
import ErrorNotice from './ErrorNotice.vue';
import ManageDisclosure from './ManageDisclosure.vue';

const props = defineProps<{ seriesId: number; hasUnlinkedSeasons: boolean }>();
const emit = defineEmits<{ changed: [] }>();

const api = useApi();
const session = inject(sessionKey, null);
const options = ref<EpisodeGroupOptions | null>(null);
const chosen = ref('');
const loading = ref(false);
const busy = ref(false);
const error = ref<unknown>(null);
const opened = ref(props.hasUnlinkedSeasons);

const REGULAR = '';
const suggested = computed(() =>
  options.value?.groups.find((group) => group.id === options.value?.suggested),
);

async function load(): Promise<void> {
  if (options.value || loading.value) return;
  loading.value = true;
  error.value = null;
  try {
    const loaded = await api.episodeGroups(props.seriesId);
    options.value = loaded;
    chosen.value = loaded.suggested ?? loaded.current ?? REGULAR;
  } catch (cause) {
    error.value = cause;
  } finally {
    loading.value = false;
  }
}

function onToggle(open: boolean): void {
  opened.value = open;
  if (opened.value) void load();
}

function label(group: EpisodeGroupOptions['groups'][number]): string {
  return messages.ordering.groupOption(
    group.name,
    messages.ordering.typeLabels[group.type] ?? String(group.type),
    group.groupCount,
    group.episodeCount,
  );
}

async function apply(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await saveForAll(
      (saveOptions) =>
        api.setSeasonOrdering(
          props.seriesId,
          chosen.value === REGULAR ? null : chosen.value,
          saveOptions,
        ),
      session?.user.value?.role === 'owner',
      () => window.confirm(messages.ordering.confirmForAll),
    );
    options.value = null;
    emit('changed');
    await load();
  } catch (cause) {
    error.value =
      cause instanceof ApiRequestError && cause.code === 'catalog_shared'
        ? new Error(messages.ordering.sharedNotice)
        : cause;
  } finally {
    busy.value = false;
  }
}

if (props.hasUnlinkedSeasons) void load();
</script>

<template>
  <ManageDisclosure :title="messages.ordering.title" :open="opened" @toggle="onToggle">
    <p class="muted">{{ messages.ordering.description }}</p>
    <p v-if="loading" class="muted">{{ messages.ordering.loading }}</p>
    <template v-if="options">
      <p v-if="suggested" class="suggestion" role="note">
        {{ messages.ordering.suggestion(suggested.name) }}
      </p>
      <p v-if="options.groups.length === 0" class="muted">{{ messages.ordering.none }}</p>
      <form class="row" @submit.prevent="apply">
        <label>
          <span class="muted">{{ messages.ordering.label }}</span>
          <select v-model="chosen">
            <option :value="REGULAR">{{ messages.ordering.regular }}</option>
            <option v-for="group in options.groups" :key="group.id" :value="group.id">
              {{ label(group) }}
            </option>
          </select>
        </label>
        <button type="submit" :disabled="busy || chosen === (options.current ?? REGULAR)">
          {{ messages.ordering.apply }}
        </button>
      </form>
    </template>
    <ErrorNotice :error="error" />
  </ManageDisclosure>
</template>

<style scoped>
.suggestion {
  padding: 8px 12px;
  border-radius: var(--radius);
  background: var(--surface-high);
}

label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}
</style>
