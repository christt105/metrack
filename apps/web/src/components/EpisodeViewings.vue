<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Viewing } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';
import { todayIso } from '../logic/todayIso';
import {
  formIsValid,
  newestFirst,
  viewingFromForm,
  withReplaced,
  withViewing,
  withoutViewing,
} from '../logic/viewingEdits';
import ViewingRow from './ViewingRow.vue';

const messages = useMessages();
const props = defineProps<{ viewings: Viewing[]; busy: boolean }>();
const emit = defineEmits<{ change: [viewings: Viewing[]] }>();

const start = ref('');
const end = ref(todayIso());
const listed = computed(() => newestFirst(props.viewings));
const canAdd = computed(() => end.value !== '' && formIsValid(start.value, end.value, true));

function add(): void {
  if (!canAdd.value) return;
  emit('change', withViewing(props.viewings, viewingFromForm(start.value, end.value)));
  start.value = '';
}
</script>

<template>
  <div class="viewings">
    <h4>{{ messages.episodes.viewings }}</h4>
    <p v-if="listed.length === 0" class="muted">{{ messages.episodes.noViewings }}</p>
    <ul v-else class="dates">
      <ViewingRow
        v-for="(viewing, index) in listed"
        :key="`${viewing.startedAt}|${viewing.finishedAt}`"
        :viewing="viewing"
        :busy="busy"
        @change="emit('change', withReplaced(viewings, index, $event))"
        @remove="emit('change', withoutViewing(viewings, index))"
      />
    </ul>
    <form class="add" @submit.prevent="add">
      <label>
        <span>{{ messages.rewatches.start }}</span>
        <input v-model="start" type="date" />
      </label>
      <label>
        <span>{{ messages.rewatches.end }}</span>
        <input v-model="end" type="date" required />
      </label>
      <button type="submit" class="small" :disabled="busy || !canAdd">
        {{ messages.episodes.addViewing }}
      </button>
    </form>
  </div>
</template>

<style scoped>
h4 {
  margin: 0 0 var(--s-2);
  font-size: var(--t-small);
}

.dates {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  margin: 0 0 12px;
  list-style: none;
}

.add {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}

.add label {
  display: flex;
  flex: 1 1 120px;
  flex-direction: column;
  gap: 2px;
}
</style>
