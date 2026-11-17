<script setup lang="ts">
import { ref } from 'vue';
import type { Collection, Viewing } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{
  collection: Collection;
  id: number;
  rewatches: Viewing[];
  completed: boolean;
}>();
const emit = defineEmits<{ updated: [detail: AnyDetail] }>();

const api = useApi();
const date = ref(new Date().toISOString().slice(0, 10));
const busy = ref(false);
const error = ref<unknown>(null);

async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    emit('updated', (await action()) as AnyDetail);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

function describe(viewing: Viewing): string {
  if (viewing.finishedAt === null) return `${viewing.startedAt ?? ''} ...`;
  return viewing.startedAt ? `${viewing.startedAt} - ${viewing.finishedAt}` : viewing.finishedAt;
}

const add = () => run(() => api.addRewatch(props.collection, props.id, date.value));
const remove = (value: string) => run(() => api.removeRewatch(props.collection, props.id, value));
</script>

<template>
  <div>
    <p v-if="rewatches.length === 0" class="muted">{{ messages.rewatches.empty }}</p>
    <ul v-else class="dates">
      <li v-for="viewing in rewatches" :key="`${viewing.startedAt}|${viewing.finishedAt}`">
        <span>{{ describe(viewing) }}</span>
        <button
          v-if="viewing.finishedAt"
          type="button"
          class="small danger"
          :disabled="busy"
          @click="remove(viewing.finishedAt)"
        >
          {{ messages.common.remove }}
        </button>
      </li>
    </ul>
    <form v-if="completed" class="row" @submit.prevent="add">
      <input
        v-model="date"
        type="date"
        required
        class="date"
        :aria-label="messages.rewatches.add"
      />
      <button type="submit" :disabled="busy">{{ messages.rewatches.add }}</button>
    </form>
    <p v-else class="muted">{{ messages.rewatches.onlyCompleted }}</p>
    <ErrorNotice :error="error" />
  </div>
</template>

<style scoped>
.dates {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dates li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.date {
  width: auto;
}
</style>
