<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMessages } from '../composables/useMessages';
import { todayIso } from '../logic/todayIso';

const messages = useMessages();
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
      <label>
        <span>{{ messages.rewatches.seenOn }}</span>
        <input v-model="end" type="date" :max="max" :required="required" />
      </label>
      <label class="toggle">
        <input v-model="different" type="checkbox" />
        <span>{{ messages.rewatches.differentStart }}</span>
      </label>
      <label v-if="different">
        <span>{{ messages.rewatches.start }}</span>
        <input v-model="start" type="date" :max="end || max" />
      </label>
    </template>
    <template v-else>
      <label>
        <span>{{ messages.rewatches.start }}</span>
        <input v-model="start" type="date" :max="max" />
      </label>
      <label>
        <span>{{ messages.rewatches.end }}</span>
        <input v-model="end" type="date" :max="max" :required="required" />
      </label>
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

label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

input[type='date'] {
  width: 100%;
  min-width: 0;
}

.toggle {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.toggle input {
  width: auto;
  min-height: 0;
}
</style>
