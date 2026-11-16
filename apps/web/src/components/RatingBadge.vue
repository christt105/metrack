<script setup lang="ts">
import { computed } from 'vue';
import { ratingDisplay } from '../logic/ratingDisplay';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ rating: number; compact?: boolean; size?: number }>();
const display = computed(() => ratingDisplay(props.rating));
</script>

<template>
  <span
    class="rating-badge"
    :class="{ compact }"
    :style="{ color: display.color }"
    :title="compact ? display.label : undefined"
  >
    <AppIcon :name="display.icon" :size="size ?? 18" />
    <span :class="compact ? 'visually-hidden' : 'word'">{{ display.label }}</span>
  </span>
</template>

<style scoped>
.rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.word {
  color: var(--on-surface);
}
</style>
