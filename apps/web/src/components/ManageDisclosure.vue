<script setup lang="ts">
defineProps<{ title: string; hint?: string }>();
</script>

<template>
  <details class="panel disclosure">
    <summary>
      <h3>{{ title }}</h3>
      <span v-if="hint" class="muted">{{ hint }}</span>
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
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px var(--s-3);
}

summary h3 {
  margin: 0;
}

.disclosure__body {
  margin-top: var(--s-4);
}
</style>
