<script setup lang="ts">
import { ref, useId, watch } from 'vue';
import { useMessages } from '../composables/useMessages';
import { todayIso } from '../logic/todayIso';
import DatePicker from './DatePicker.vue';

const messages = useMessages();
const startId = useId();
const endId = useId();
const props = defineProps<{ single: boolean; required: boolean }>();
const start = defineModel<string>('start', { required: true });
const end = defineModel<string>('end', { required: true });

const different = ref(start.value !== '' && start.value !== end.value);
const max = todayIso();

watch(
  [start, end, different, () => props.single],
  () => {
    if (props.single && !different.value) start.value = end.value;
  },
  { immediate: true },
);
</script>

<template>
  <div class="fields">
    <template v-if="single">
      <div class="date-item">
        <label :for="endId">{{ messages.rewatches.seenOn }}</label>
        <DatePicker :id="endId" v-model="end" :max="max" :required="required" />
      </div>
      <label class="toggle">
        <input v-model="different" type="checkbox" />
        <span>{{ messages.rewatches.differentStart }}</span>
      </label>
      <div v-if="different" class="date-item">
        <label :for="startId">{{ messages.rewatches.start }}</label>
        <DatePicker :id="startId" v-model="start" :max="end || max" />
      </div>
    </template>
    <template v-else>
      <div class="date-item">
        <label :for="startId">{{ messages.rewatches.start }}</label>
        <DatePicker :id="startId" v-model="start" :max="max" />
      </div>
      <div class="date-item">
        <label :for="endId">{{ messages.rewatches.end }}</label>
        <DatePicker :id="endId" v-model="end" :max="max" :required="required" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.fields {
  display: flex;
  flex: 1 1 200px;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.date-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.toggle {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.toggle input {
  width: auto;
  min-height: 0;
}
</style>
