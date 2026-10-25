<script setup lang="ts">
import { ref } from 'vue';
import type { Collection } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{
  collection: Collection;
  id: number;
  rewatches: string[];
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

const add = () => run(() => api.addRewatch(props.collection, props.id, date.value));
const remove = (value: string) => run(() => api.removeRewatch(props.collection, props.id, value));
</script>

<template>
  <section class="panel">
    <h2>{{ messages.detail.sectionRewatches }}</h2>
    <p v-if="rewatches.length === 0" class="muted">{{ messages.rewatches.empty }}</p>
    <ul v-else class="dates">
      <li v-for="value in rewatches" :key="value">
        <span>{{ value }}</span>
        <button type="button" class="small danger" :disabled="busy" @click="remove(value)">
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
  </section>
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
