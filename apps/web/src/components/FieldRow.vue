<script setup lang="ts">
import { messages } from '../i18n/messages';

defineProps<{ id: string; label: string; edited?: boolean; hint?: string; invalid?: string }>();
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
      <button
        v-if="edited"
        type="button"
        class="small"
        :title="messages.detail.releaseHint"
        @click="$emit('release')"
      >
        {{ messages.detail.release }}
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
