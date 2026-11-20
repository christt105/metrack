<script setup lang="ts">
import { useMessages } from '../composables/useMessages';

const messages = useMessages();
</script>

<template>
  <span class="badge" :title="messages.pending.hint">{{ messages.pending.badge }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--t-label);
  font-weight: 500;
  color: var(--warning);
  border: 1px solid currentColor;
  white-space: nowrap;
}
</style>
