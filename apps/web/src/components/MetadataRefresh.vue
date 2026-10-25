<script setup lang="ts">
import { ref } from 'vue';
import type { MediaType, RefreshResult } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import { errorMessage } from '../logic/errorMessage';

const props = defineProps<{ type: MediaType; id: number; fetchedAt: string | null }>();
const emit = defineEmits<{ refreshed: [] }>();

const api = useApi();
const busy = ref(false);
const outcome = ref<string | null>(null);
const failed = ref(false);

function describe(result: RefreshResult): string {
  const texts = messages.detail.refreshOutcome;
  switch (result.outcome) {
    case 'updated':
      return texts.updated(result.fields);
    case 'failed':
      return texts.failed(result.error);
    case 'unchanged':
      return texts.unchanged;
    default:
      return texts.fresh;
  }
}

async function refresh(): Promise<void> {
  busy.value = true;
  outcome.value = null;
  failed.value = false;
  try {
    const result = await api.refreshMetadata(props.type, props.id);
    failed.value = result.outcome === 'failed';
    outcome.value = describe(result);
    emit('refreshed');
  } catch (cause) {
    failed.value = true;
    outcome.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="refresh">
    <div class="row">
      <button type="button" :disabled="busy" @click="refresh">
        {{ busy ? messages.detail.refreshing : messages.detail.refresh }}
      </button>
      <small class="muted">{{
        fetchedAt ? messages.detail.fetchedAt(fetchedAt) : messages.detail.notFetched
      }}</small>
    </div>
    <p v-if="outcome" class="notice" :class="failed ? 'error' : 'success'" role="status">
      {{ outcome }}
    </p>
  </div>
</template>

<style scoped>
.refresh p {
  margin: 8px 0 0;
}
</style>
