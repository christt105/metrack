<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import type { Collection, MediaStatus } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { sessionKey } from '../auth/sessionKey';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import type { QuickChange } from '../logic/QuickChange';
import {
  ratingChange,
  statusChange,
  watchedTodayChange,
  type QuickTracking,
} from '../logic/quickChanges';
import { ratingDisplay } from '../logic/ratingDisplay';
import { saveForAll } from '../logic/saveForAll';
import { statusOptions } from '../logic/statusOptions';
import { todayIso } from '../logic/todayIso';
import AppIcon from './AppIcon.vue';
import ErrorNotice from './ErrorNotice.vue';
import RatingPicker from './RatingPicker.vue';
import UndoToast from './UndoToast.vue';

const TOAST_MS = 6000;

const props = defineProps<{ collection: Collection; detail: AnyDetail }>();
const emit = defineEmits<{ saved: [detail: AnyDetail] }>();

const api = useApi();
const session = inject(sessionKey, null);
const busy = ref(false);
const error = ref<unknown>(null);
const pickerOpen = ref(false);
const toast = ref<{ message: string; undo: Record<string, unknown> | null } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

const tracking = computed(() => props.detail as unknown as QuickTracking);
const options = computed(() => statusOptions(tracking.value.status));
const rating = computed(() => tracking.value.rating);

async function send(patch: Record<string, unknown>): Promise<void> {
  const updated = await saveForAll(
    (options) => api.patch(props.collection, props.detail.id, patch as never, options),
    session?.user.value?.role === 'owner',
    () => window.confirm(messages.detail.confirmForAll),
  );
  emit('saved', updated as AnyDetail);
}

function say(message: string, undo: Record<string, unknown> | null): void {
  clearTimeout(timer);
  toast.value = { message, undo };
  timer = setTimeout(dismiss, TOAST_MS);
}

function dismiss(): void {
  clearTimeout(timer);
  toast.value = null;
}

async function apply(change: QuickChange, message: string): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    await send(change.patch);
    say(message, change.undo);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

async function undo(): Promise<void> {
  const patch = toast.value?.undo;
  if (!patch || busy.value) return;
  dismiss();
  busy.value = true;
  error.value = null;
  try {
    await send(patch);
    say(messages.quick.undone, null);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

function onStatus(event: Event): void {
  const next = (event.target as HTMLSelectElement).value as MediaStatus;
  if (next === tracking.value.status) return;
  void apply(
    statusChange(tracking.value, next),
    messages.quick.statusChanged(messages.statusLabels[next]),
  );
}

function onRating(value: number | null): void {
  pickerOpen.value = false;
  if (value === rating.value) return;
  void apply(
    ratingChange(tracking.value, value),
    value === null
      ? messages.ratingPicker.cleared
      : messages.ratingPicker.rated(ratingDisplay(value).label),
  );
}

function watchedToday(): void {
  void apply(watchedTodayChange(tracking.value, todayIso()), messages.quick.watchedDone);
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="quick" role="group" :aria-label="messages.quick.label">
    <label class="status">
      <span class="visually-hidden">{{ messages.quick.status }}</span>
      <select :value="tracking.status" :disabled="busy" @change="onStatus">
        <option v-for="option in options" :key="option" :value="option">
          {{ messages.statusLabels[option] }}
        </option>
      </select>
    </label>
    <button
      type="button"
      class="rate"
      :aria-expanded="pickerOpen"
      :disabled="busy"
      @click="pickerOpen = !pickerOpen"
    >
      <AppIcon name="star" :size="18" />
      {{ rating === null ? messages.ratingPicker.unrated : messages.ratingPicker.change }}
    </button>
    <button type="button" :disabled="busy" @click="watchedToday">
      <AppIcon name="check" :size="18" />
      {{ messages.quick.watchedToday }}
    </button>
    <RatingPicker
      v-if="pickerOpen"
      class="picker"
      :model-value="rating"
      @update:model-value="onRating"
    />
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
.quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2) var(--s-3);
}

.picker {
  flex-basis: 100%;
}
</style>
