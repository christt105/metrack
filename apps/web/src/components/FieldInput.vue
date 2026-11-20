<script setup lang="ts">
import { computed } from 'vue';
import type { DraftValue } from '../logic/formDraft';
import type { FieldKind } from '../logic/FieldSchema';
import RatingPicker from './RatingPicker.vue';

defineProps<{ id: string; kind: FieldKind; required?: boolean; disabled?: boolean }>();
const model = defineModel<DraftValue>({ required: true });

const text = computed({
  get: () => String(model.value),
  set: (value: string) => {
    model.value = value;
  },
});
const ratingValue = computed({
  get: () => {
    const value = Number(model.value);
    return model.value === '' || !Number.isFinite(value) ? null : value;
  },
  set: (value: number | null) => {
    model.value = value === null ? '' : String(value);
  },
});
const checked = computed({
  get: () => model.value === true,
  set: (value: boolean) => {
    model.value = value;
  },
});
</script>

<template>
  <input v-if="kind === 'boolean'" :id="id" v-model="checked" type="checkbox" />
  <textarea v-else-if="kind === 'textarea'" :id="id" v-model="text" />
  <input
    v-else-if="kind === 'date'"
    :id="id"
    v-model="text"
    type="date"
    :required="required"
    :disabled="disabled"
  />
  <input
    v-else-if="kind === 'integer'"
    :id="id"
    v-model="text"
    type="number"
    min="0"
    step="1"
    inputmode="numeric"
    :required="required"
  />
  <input
    v-else-if="kind === 'hours'"
    :id="id"
    v-model="text"
    type="text"
    inputmode="decimal"
    placeholder="12.5 / 12:30"
    autocomplete="off"
  />
  <RatingPicker v-else-if="kind === 'rating'" :id="id" v-model="ratingValue" />
  <input v-else :id="id" v-model="text" type="text" :required="required" autocomplete="off" />
</template>
