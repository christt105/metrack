<script setup lang="ts">
import AppIcon from './AppIcon.vue';

defineProps<{ title: string; hint?: string; open?: boolean }>();
const emit = defineEmits<{ toggle: [open: boolean] }>();

function onToggle(event: Event): void {
  emit('toggle', (event.target as HTMLDetailsElement).open);
}
</script>

<template>
  <details class="panel disclosure" :open="open" @toggle="onToggle">
    <summary>
      <span class="text">
        <h3>{{ title }}</h3>
        <span v-if="hint" class="muted">{{ hint }}</span>
      </span>
      <span class="chevron" aria-hidden="true">
        <AppIcon name="chevron" :size="20" />
      </span>
    </summary>
    <div class="disclosure__body">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.disclosure {
  margin-bottom: 0;
}

summary {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

.text {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px var(--s-3);
  min-width: 0;
}

.text h3 {
  margin: 0;
}

.chevron {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--outline);
  border-radius: 50%;
  color: var(--on-surface);
  transition: transform var(--m-press) ease;
}

.disclosure[open] .chevron {
  transform: rotate(90deg);
}

summary:hover .chevron {
  background: var(--surface-high);
}

.disclosure__body {
  margin-top: var(--s-4);
}
</style>
