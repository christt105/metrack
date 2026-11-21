<script setup lang="ts">
import { ref } from 'vue';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import { refreshSteamAchievements } from '../logic/refreshSteamAchievements';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ gameId?: number; label: string }>();
const emit = defineEmits<{ done: [] }>();

const messages = useMessages();
const api = useApi();
const progress = ref<{ done: number; total: number } | null>(null);
const summary = ref<string | null>(null);
const error = ref<unknown>(null);

async function run(): Promise<void> {
  error.value = null;
  summary.value = null;
  progress.value = { done: 0, total: 0 };
  try {
    const pass = await refreshSteamAchievements(
      (request) =>
        api.refreshSteamAchievements(
          props.gameId === undefined ? request : { ...request, gameId: props.gameId },
        ),
      (done, total) => (progress.value = { done, total }),
    );
    summary.value = messages.steam.achievements.done(pass.processed, pass.failed);
    emit('done');
  } catch (cause) {
    error.value = cause;
  } finally {
    progress.value = null;
  }
}
</script>

<template>
  <div data-test="achievements-refresh">
    <button
      type="button"
      :disabled="progress !== null"
      data-test="achievements-button"
      @click="run"
    >
      {{ label }}
    </button>
    <span v-if="progress" class="muted" data-test="achievements-progress">
      <progress :value="progress.done" :max="progress.total || 1"></progress>
      {{ messages.steam.achievements.checking(progress.done, progress.total) }}
    </span>
    <p v-else-if="summary" class="muted" data-test="achievements-summary">{{ summary }}</p>
    <ErrorNotice :error="error" />
  </div>
</template>
