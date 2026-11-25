<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, watchEffect } from 'vue';
import { useMessages } from '../composables/useMessages';
import { addDays, addMonths } from '../logic/calendar/dates';
import { monthGrid } from '../logic/calendar/monthGrid';
import { todayIso } from '../logic/todayIso';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ id?: string; max?: string; required?: boolean; disabled?: boolean }>();
const model = defineModel<string>({ required: true });
const messages = useMessages();
const dialogId = useId();
const titleId = `${dialogId}-title`;
const field = ref<HTMLInputElement | null>(null);
const dialog = ref<HTMLDialogElement | null>(null);
const open = ref(false);
const today = ref(todayIso());
const active = ref(today.value);
const month = computed(() => active.value.slice(0, 7));
const weeks = computed(() => monthGrid(month.value));
const nextBlocked = computed(() => !!props.max && month.value >= props.max.slice(0, 7));
const selected = computed(() => {
  const date = new Date(`${model.value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === model.value
    ? model.value
    : '';
});
const display = computed(() => (selected.value ? messages.datePicker.field(selected.value) : ''));
const dayOffsets = new Map([
  ['ArrowLeft', -1],
  ['ArrowRight', 1],
  ['ArrowUp', -7],
  ['ArrowDown', 7],
]);

function tooLate(date: string): boolean {
  return !!props.max && date > props.max;
}

watchEffect(() => {
  const max = props.max;
  field.value?.setCustomValidity(
    max && tooLate(selected.value) ? messages.datePicker.tooLate(max) : '',
  );
});

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled && open.value) close();
  },
);

async function focusDay(): Promise<void> {
  await nextTick();
  dialog.value?.querySelector<HTMLElement>('button.day[tabindex="0"]')?.focus();
}

async function show(): Promise<void> {
  if (props.disabled || open.value) return;
  today.value = todayIso();
  const date = selected.value || today.value;
  active.value = props.max && tooLate(date) ? props.max : date;
  open.value = true;
  await nextTick();
  dialog.value?.showModal();
  await focusDay();
}

function close(): void {
  dialog.value?.close();
  open.value = false;
  field.value?.focus();
}

function restoreField(event: Event): void {
  (event.target as HTMLInputElement).value = display.value;
}

function select(date: string): void {
  model.value = date;
  close();
}

function moveMonth(offset: number): void {
  active.value = `${addMonths(month.value, offset)}-01`;
  if (offset > 0 && nextBlocked.value) void focusDay();
}

function moveDay(event: KeyboardEvent): void {
  const offset = dayOffsets.get(event.key);
  if (offset === undefined) return;
  event.preventDefault();
  const date = addDays(active.value, offset);
  if (tooLate(date)) return;
  active.value = date;
  void focusDay();
}
</script>

<template>
  <div class="date-field">
    <input
      :id="id"
      ref="field"
      class="date-trigger"
      type="text"
      role="combobox"
      inputmode="none"
      autocomplete="off"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="open ? dialogId : undefined"
      :placeholder="messages.datePicker.choose"
      :value="display"
      :required="required"
      :disabled="disabled"
      @beforeinput.prevent
      @input="restoreField"
      @click="show"
      @keydown.enter.prevent="show"
      @keydown.down.prevent="show"
      @keydown.space.prevent="show"
    />
    <AppIcon class="date-icon" name="calendar" :size="18" />
    <Teleport to="body">
      <dialog
        v-if="open"
        :id="dialogId"
        ref="dialog"
        class="date-dialog"
        :aria-labelledby="titleId"
        @click.self="close"
        @cancel.prevent="close"
        @keydown.esc.stop.prevent="close"
      >
        <div class="date-panel">
          <div class="date-bar">
            <button
              class="month-nav"
              type="button"
              :aria-label="messages.datePicker.previousMonth"
              @click="moveMonth(-1)"
            >
              <AppIcon name="back" :size="18" />
            </button>
            <h2 :id="titleId" aria-live="polite">{{ messages.datePicker.month(month) }}</h2>
            <button
              class="month-nav"
              type="button"
              :disabled="nextBlocked"
              :aria-label="messages.datePicker.nextMonth"
              @click="moveMonth(1)"
            >
              <AppIcon name="chevron" :size="18" />
            </button>
          </div>
          <div role="grid" :aria-labelledby="titleId" @keydown="moveDay">
            <div class="week weekdays" role="row">
              <span v-for="day in messages.datePicker.weekdays" :key="day" role="columnheader">
                {{ day }}
              </span>
            </div>
            <div v-for="week in weeks" :key="week[0]?.date" class="week" role="row">
              <div
                v-for="day in week"
                :key="day.date"
                role="gridcell"
                :aria-selected="day.date === selected"
              >
                <button
                  class="day"
                  :class="{ adjacent: !day.inMonth, selected: day.date === selected }"
                  type="button"
                  :data-date="day.date"
                  :tabindex="day.date === active ? 0 : -1"
                  :aria-label="messages.datePicker.day(day.date)"
                  :aria-current="day.date === today ? 'date' : undefined"
                  :disabled="tooLate(day.date)"
                  @click="select(day.date)"
                  @keydown.enter.prevent="select(day.date)"
                >
                  {{ day.day }}
                </button>
              </div>
            </div>
          </div>
          <div class="date-actions">
            <button class="ghost" type="button" :disabled="tooLate(today)" @click="select(today)">
              {{ messages.datePicker.today }}
            </button>
            <button v-if="!required" class="ghost" type="button" @click="select('')">
              {{ messages.datePicker.clear }}
            </button>
            <button class="ghost cancel" type="button" @click="close">
              {{ messages.common.cancel }}
            </button>
          </div>
        </div>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
.date-field {
  position: relative;
  width: 100%;
  min-width: 0;
}

.date-trigger {
  padding-inline-end: 36px;
}

.date-icon {
  position: absolute;
  top: 50%;
  inset-inline-end: 12px;
  translate: 0 -50%;
  color: var(--muted);
  pointer-events: none;
}

.date-trigger:not(:disabled) {
  cursor: pointer;
}

.date-dialog {
  width: 360px;
  max-width: calc(100% - 16px);
  max-height: calc(100% - 16px);
  padding: 0;
  color: var(--on-surface);
  background: var(--surface-low);
  border: 1px solid var(--outline);
  border-radius: var(--r-lg);
  overflow: auto;
}

.date-dialog::backdrop {
  background: rgb(0 0 0 / 50%);
}

.date-panel {
  padding: var(--s-2);
}

.date-bar,
.date-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.date-bar h2 {
  margin: 0;
  font-size: 18px;
  text-align: center;
}

.month-nav {
  width: 44px;
  padding: 0;
}

.week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  text-align: center;
}

.weekdays {
  padding: var(--s-2) 0;
  color: var(--muted);
  font-size: var(--t-label);
}

.day {
  width: 100%;
  padding: 0;
  border-color: transparent;
  background: transparent;
  font-variant-numeric: tabular-nums;
}

.day.adjacent {
  color: var(--muted);
}

.day[aria-current='date'] {
  border-color: var(--outline-strong);
}

.day.selected,
.day.selected:hover:not(:disabled) {
  color: var(--on-primary);
  background: var(--primary);
}

.date-actions button {
  padding-inline: var(--s-2);
}

.cancel {
  margin-inline-start: auto;
}
</style>
