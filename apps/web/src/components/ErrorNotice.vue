<script setup lang="ts">
import { computed } from 'vue';
import { useMessages } from '../composables/useMessages';
import { errorMessage } from '../logic/errorMessage';

const messages = useMessages();

const props = defineProps<{ error: unknown }>();
const text = computed(() => (props.error ? errorMessage(props.error, messages) : ''));
</script>

<template>
  <p v-if="text" class="notice error" role="alert">{{ text }}</p>
</template>
