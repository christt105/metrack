<script setup lang="ts">
import { computed } from 'vue';
import { errorMessage } from '../logic/errorMessage';

const props = defineProps<{ error: unknown }>();
const text = computed(() => (props.error ? errorMessage(props.error) : ''));
</script>

<template>
  <p v-if="text" class="notice error" role="alert">{{ text }}</p>
</template>
