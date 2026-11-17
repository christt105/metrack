<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { Collection, Viewing } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import { todayIso } from '../logic/todayIso';
import {
  formIsValid,
  newestFirst,
  viewingFromForm,
  withReplaced,
  withViewing,
  withoutViewing,
} from '../logic/viewingEdits';
import ErrorNotice from './ErrorNotice.vue';
import UndoToast from './UndoToast.vue';
import ViewingRow from './ViewingRow.vue';

const TOAST_MS = 6000;

const props = defineProps<{
  collection: Collection;
  id: number;
  rewatches: Viewing[];
  completed: boolean;
}>();
const emit = defineEmits<{ updated: [detail: AnyDetail] }>();

const api = useApi();
const start = ref('');
const end = ref(todayIso());
const busy = ref(false);
const error = ref<unknown>(null);
const toast = ref<{ message: string; undo: Viewing[] | null } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

const viewings = computed(() => newestFirst(props.rewatches));
const rewatching = computed(() => props.rewatches.some((v) => v.finishedAt === null));
const canAdd = computed(() => formIsValid(start.value, end.value, true));

function say(message: string, undo: Viewing[] | null): void {
  clearTimeout(timer);
  toast.value = { message, undo };
  timer = setTimeout(dismiss, TOAST_MS);
}

function dismiss(): void {
  clearTimeout(timer);
  toast.value = null;
}

async function replace(next: Viewing[], message: string, undo: Viewing[] | null): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    const patch = undo === null ? { restore: true, rewatches: next } : { rewatches: next };
    emit('updated', (await api.patch(props.collection, props.id, patch as never)) as AnyDetail);
    say(message, undo);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

function change(next: Viewing[], message: string): Promise<void> {
  return replace(next, message, [...props.rewatches]);
}

function undo(): Promise<void> {
  const previous = toast.value?.undo;
  dismiss();
  return previous ? replace(previous, messages.quick.undone, null) : Promise.resolve();
}

async function add(): Promise<void> {
  if (!canAdd.value) return;
  await change(
    withViewing(props.rewatches, viewingFromForm(start.value, end.value)),
    messages.rewatches.added,
  );
  start.value = '';
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div>
    <p v-if="viewings.length === 0" class="muted">{{ messages.rewatches.empty }}</p>
    <ul v-else class="dates">
      <ViewingRow
        v-for="(viewing, index) in viewings"
        :key="`${viewing.startedAt}|${viewing.finishedAt}`"
        :viewing="viewing"
        :busy="busy"
        @change="change(withReplaced(rewatches, index, $event), messages.rewatches.changed)"
        @remove="change(withoutViewing(rewatches, index), messages.rewatches.removed)"
      />
    </ul>
    <form v-if="completed" class="add" @submit.prevent="add">
      <label>
        <span>{{ messages.rewatches.start }}</span>
        <input v-model="start" type="date" />
      </label>
      <label>
        <span>{{ messages.rewatches.end }}</span>
        <input v-model="end" type="date" required />
      </label>
      <button type="submit" :disabled="busy || !canAdd">{{ messages.rewatches.add }}</button>
    </form>
    <p v-else-if="!rewatching" class="muted">{{ messages.rewatches.onlyCompleted }}</p>
    <ErrorNotice :error="error" />
    <Teleport to="body">
      <UndoToast
        v-if="toast"
        :message="toast.message"
        :undoable="toast.undo !== null"
        @undo="undo"
        @dismiss="dismiss"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.dates {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.add {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}

.add label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 140px;
}
</style>
