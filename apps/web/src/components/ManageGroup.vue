<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <section class="panel group">
    <h3>{{ title }}</h3>
    <slot />
  </section>
</template>

<style scoped>
.group {
  margin-bottom: 0;
}
</style>
