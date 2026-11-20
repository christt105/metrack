<script setup lang="ts">
import { computed } from 'vue';
import { useMessages } from '../composables/useMessages';

const messages = useMessages();
const props = defineProps<{
  watched: number | null;
  total: number | null;
  skipped?: number;
  rewatch?: boolean;
}>();

const share = computed(() =>
  props.watched !== null && props.total ? Math.min(1, props.watched / props.total) : null,
);
const label = computed(() => {
  if (props.total === null) return null;
  if (props.watched === null) return messages.hero.episodes(props.total);
  if (props.rewatch) return messages.episodes.rewatchOf(props.watched, props.total);
  if (props.skipped)
    return messages.seasons.watchedOfSkipped(props.watched, props.total, props.skipped);
  return messages.seasons.watchedOf(props.watched, props.total);
});
</script>

<template>
  <div v-if="label" class="progress">
    <span class="label">{{ label }}</span>
    <span
      v-if="share !== null"
      class="bar"
      role="progressbar"
      :aria-valuenow="watched ?? 0"
      :aria-valuemax="total ?? 0"
      aria-valuemin="0"
      :aria-label="label"
    >
      <span class="fill" :style="{ transform: `scaleX(${share})` }"></span>
    </span>
  </div>
</template>

<style scoped>
.progress {
  display: grid;
  gap: 6px;
}

.label {
  color: var(--muted);
  font-size: var(--t-label);
}

.bar {
  display: block;
  height: 4px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--surface-highest);
}

.fill {
  display: block;
  height: 100%;
  background: var(--primary);
  transform-origin: left;
}
</style>
