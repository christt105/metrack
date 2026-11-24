<script setup lang="ts">
import { ref } from 'vue';
import type { Viewing } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';
import { describeViewing, formIsValid, viewingFromForm } from '../logic/viewingEdits';
import ViewingDateFields from './ViewingDateFields.vue';

const messages = useMessages();
const props = withDefaults(
  defineProps<{
    viewing: Viewing;
    busy: boolean;
    readonly?: boolean;
    removable?: boolean;
    single?: boolean;
    label?: string;
  }>(),
  { removable: true, label: undefined },
);
const emit = defineEmits<{ change: [viewing: Viewing]; remove: [] }>();

const editing = ref(false);
const start = ref('');
const end = ref('');

const isOpen = () => props.viewing.finishedAt === null;
const singleDate = () => props.single === true && !(isOpen() && props.viewing.startedAt !== null);

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
      <span v-if="label" class="label">{{ label }}</span>
      <ViewingDateFields
        v-model:start="start"
        v-model:end="end"
        :single="singleDate()"
        :required="!isOpen()"
      />
      <div class="actions">
        <button type="submit" class="small" :disabled="busy">{{ messages.common.save }}</button>
        <button type="button" class="small ghost" @click="editing = false">
          {{ messages.common.cancel }}
        </button>
      </div>
    </form>
    <template v-else>
      <span v-if="label" class="label">{{ label }}</span>
      <span class="text"
        >{{ describeViewing(viewing, messages)
        }}<span v-if="viewing.abandonedAt" class="muted">
          ·
          {{
            messages.episodes.abandonedViewing(messages.episodes.airDate(viewing.abandonedAt))
          }}</span
        ></span
      >
      <span v-if="!readonly" class="actions">
        <button type="button" class="small ghost" :disabled="busy" @click="edit">
          {{ messages.common.edit }}
        </button>
        <button
          v-if="removable"
          type="button"
          class="small danger"
          :disabled="busy"
          @click="emit('remove')"
        >
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
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.label {
  display: -webkit-box;
  flex: 1 1 100%;
  min-width: 0;
  overflow: hidden;
  font-weight: 500;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.actions {
  display: flex;
  gap: 8px;
}
</style>
