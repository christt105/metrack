<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { HealthReport } from '@metrack/domain';
import { fetchHealth } from './api/fetchHealth';

const health = ref<HealthReport | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    health.value = await fetchHealth();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <main>
    <h1>metrack</h1>
    <p v-if="error">Service unavailable: {{ error }}</p>
    <p v-else-if="health">
      Status: {{ health.status }} (version {{ health.appVersion }}, schema
      {{ health.schemaVersion }})
    </p>
    <p v-else>Loading...</p>
  </main>
</template>
