<script setup lang="ts">
import { messages } from '../i18n/messages';
</script>

<template>
  <span class="badge" :title="messages.pending.hint">{{ messages.pending.badge }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  color: var(--warning);
  border: 1px solid var(--warning);
  white-space: nowrap;
}
</style>
