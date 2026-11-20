<script setup lang="ts">
import { useConnectivity } from '../composables/useConnectivity';
import { useMessages } from '../composables/useMessages';

const messages = useMessages();
const connectivity = useConnectivity();
</script>

<template>
  <p v-if="connectivity.offline.value" class="notice" role="status">{{ messages.offline }}</p>
</template>
