<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { Season, Viewing } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import ErrorNotice from './ErrorNotice.vue';
import RewatchList from './RewatchList.vue';
import UndoToast from './UndoToast.vue';
import ViewingRow from './ViewingRow.vue';

const messages = useMessages();
const TOAST_MS = 6000;

const props = defineProps<{ season: Season }>();
const emit = defineEmits<{ updated: [detail: AnyDetail] }>();

const api = useApi();
const busy = ref(false);
const error = ref<unknown>(null);
const toast = ref<{ message: string; undo: Viewing } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

const own = computed<Viewing | null>(() =>
  props.season.startedAt === null && props.season.finishedAt === null
    ? null
    : { startedAt: props.season.startedAt, finishedAt: props.season.finishedAt },
);

function dismiss(): void {
  clearTimeout(timer);
  toast.value = null;
}

async function save(next: Viewing, message: string, undo: Viewing | null): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    const patch = { startedAt: next.startedAt, finishedAt: next.finishedAt };
    const body = undo === null ? { ...patch, restore: true } : patch;
    const detail = await api.library.patch('seasons', props.season.id, body as never);
    emit('updated', detail as AnyDetail);
    dismiss();
    if (undo !== null) {
      toast.value = { message, undo };
      timer = setTimeout(dismiss, TOAST_MS);
    }
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

function change(next: Viewing): Promise<void> {
  return save(next, messages.history.viewingChanged, own.value);
}

function undo(): Promise<void> {
  const previous = toast.value?.undo;
  dismiss();
  return previous ? save(previous, messages.quick.undone, null) : Promise.resolve();
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <section class="panel history" aria-labelledby="history-title">
    <h2 id="history-title">{{ messages.history.title }}</h2>
    <p class="muted intro">{{ messages.history.intro }}</p>
    <h3>{{ messages.history.firstPassDates }}</h3>
    <ul v-if="own" class="dates">
      <ViewingRow
        :key="`${own.startedAt}|${own.finishedAt}`"
        :viewing="own"
        :busy="busy"
        :removable="false"
        single
        @change="change"
      />
    </ul>
    <p v-else class="muted">{{ messages.history.noDates }}</p>
    <h3>{{ messages.history.rewatchesTitle }}</h3>
    <RewatchList
      :id="season.id"
      collection="seasons"
      :rewatches="season.rewatches"
      :completed="season.status === 'completed'"
      @updated="emit('updated', $event)"
    />
    <ErrorNotice :error="error" />
    <Teleport to="body">
      <UndoToast
        v-if="toast"
        :message="toast.message"
        :undoable="true"
        @undo="undo"
        @dismiss="dismiss"
      />
    </Teleport>
  </section>
</template>

<style scoped>
.history {
  margin-bottom: var(--s-7);
}

.intro {
  margin: 0 0 var(--s-3);
}

h3 {
  margin: var(--s-3) 0 var(--s-2);
  font-size: var(--t-small);
  font-weight: 600;
}

.dates {
  padding: 0;
  margin: 0 0 12px;
  list-style: none;
}
</style>
