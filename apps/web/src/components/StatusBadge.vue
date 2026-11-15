<script setup lang="ts">
import type { MediaStatus } from '@metrack/domain';
import { messages } from '../i18n/messages';

defineProps<{ status: MediaStatus }>();
</script>

<template>
  <span class="badge" :style="{ '--dot': `var(--status-${status})` }">
    {{ messages.statusLabels[status] }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--on-surface);
  font-size: var(--t-label);
  font-weight: 500;
  white-space: nowrap;
}

.badge::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dot);
}
</style>
