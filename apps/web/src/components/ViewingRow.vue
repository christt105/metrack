<script setup lang="ts">
import { ref } from 'vue';
import type { Viewing } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';
import { describeViewing, formIsValid, viewingFromForm } from '../logic/viewingEdits';

const messages = useMessages();
const props = defineProps<{ viewing: Viewing; busy: boolean; readonly?: boolean }>();
const emit = defineEmits<{ change: [viewing: Viewing]; remove: [] }>();

const editing = ref(false);
const start = ref('');
const end = ref('');

const isOpen = () => props.viewing.finishedAt === null;

function edit(): void {
  start.value = props.viewing.startedAt ?? '';
  end.value = props.viewing.finishedAt ?? '';
  editing.value = true;
}

function save(): void {
  if (!formIsValid(start.value, end.value, !isOpen())) return;
  editing.value = false;
  emit('change', viewingFromForm(start.value, end.value));
}
</script>

<template>
  <li class="viewing">
    <form v-if="editing" class="fields" @submit.prevent="save">
      <label>
        <span>{{ messages.rewatches.start }}</span>
        <input v-model="start" type="date" />
      </label>
      <label>
        <span>{{ messages.rewatches.end }}</span>
        <input v-model="end" type="date" :required="!isOpen()" />
      </label>
      <div class="actions">
        <button type="submit" class="small" :disabled="busy">{{ messages.common.save }}</button>
        <button type="button" class="small ghost" @click="editing = false">
          {{ messages.common.cancel }}
        </button>
      </div>
    </form>
    <template v-else>
      <span class="text">{{ describeViewing(viewing) }}</span>
      <span v-if="!readonly" class="actions">
        <button type="button" class="small ghost" :disabled="busy" @click="edit">
          {{ messages.common.edit }}
        </button>
        <button type="button" class="small danger" :disabled="busy" @click="emit('remove')">
          {{ messages.common.remove }}
        </button>
      </span>
    </template>
  </li>
</template>

<style scoped>
.viewing {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.text {
  min-width: 0;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.fields label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.actions {
  display: flex;
  gap: 8px;
}
</style>
