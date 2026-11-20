<script setup lang="ts">
import { useMessages } from '../composables/useMessages';

const messages = useMessages();
defineProps<{
  id: string;
  label: string;
  edited?: boolean;
  released?: boolean;
  hint?: string;
  invalid?: string;
}>();
defineEmits<{ release: [] }>();
</script>

<template>
  <div class="field" :class="{ invalid }">
    <label :for="id">
      {{ label }}
      <span v-if="edited" class="edited" :title="messages.detail.editedHint">{{
        messages.detail.edited
      }}</span>
    </label>
    <slot />
    <div class="below">
      <small v-if="hint" class="muted">{{ hint }}</small>
      <small v-if="invalid" class="problem">{{ invalid }}</small>
      <small v-if="released" class="muted">{{ messages.detail.releasePending }}</small>
      <button
        v-if="edited"
        type="button"
        class="small"
        :aria-pressed="released === true"
        :title="messages.detail.releaseHint"
        @click="$emit('release')"
      >
        {{ released ? messages.detail.releaseUndo : messages.detail.release }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

label {
  font-size: 0.85rem;
  color: var(--muted);
}

.edited {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--warning);
  color: #261d00;
  font-size: 0.7rem;
}

.below {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.problem {
  color: var(--danger);
}

.invalid :deep(input),
.invalid :deep(textarea) {
  border-color: var(--danger);
}
</style>
