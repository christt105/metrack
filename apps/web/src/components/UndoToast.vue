<script setup lang="ts">
import { messages } from '../i18n/messages';

defineProps<{ message: string; undoable: boolean }>();
defineEmits<{ undo: []; dismiss: [] }>();
</script>

<template>
  <div class="toast" role="status" aria-live="polite">
    <span>{{ message }}</span>
    <button v-if="undoable" type="button" class="undo" @click="$emit('undo')">
      {{ messages.quick.undo }}
    </button>
    <button
      type="button"
      class="close"
      :aria-label="messages.quick.dismiss"
      @click="$emit('dismiss')"
    >
      &times;
    </button>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: calc(var(--tabbar) + var(--s-3));
  left: 50%;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--s-3);
  width: max-content;
  max-width: calc(100vw - 2 * var(--s-3));
  padding: 10px 14px;
  transform: translateX(-50%);
  border: 1px solid var(--outline-strong);
  border-radius: var(--r-md);
  background: var(--surface-high);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
}

.undo {
  font-weight: 600;
}

.close {
  padding: 0 6px;
  border: 0;
  background: transparent;
}
</style>
