<script setup lang="ts">
import type { MediaStatus } from '@metrack/domain';
import { messages } from '../i18n/messages';

defineProps<{ status: MediaStatus }>();
</script>

<template>
  <span class="badge" :class="`status-${status}`">{{ messages.statusLabels[status] }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  background: var(--surface-highest);
  white-space: nowrap;
}

.status-in_progress {
  background: #2d4a73;
}

.status-completed {
  background: #1f4d2c;
}

.status-paused {
  background: #5c4a12;
}

.status-dropped {
  background: #5a2a26;
}
</style>
