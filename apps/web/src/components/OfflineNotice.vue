<script setup lang="ts">
import { useConnectivity } from '../composables/useConnectivity';
import { messages } from '../i18n/messages';

const connectivity = useConnectivity();
</script>

<template>
  <p v-if="connectivity.offline.value" class="notice" role="status">{{ messages.offline }}</p>
</template>
