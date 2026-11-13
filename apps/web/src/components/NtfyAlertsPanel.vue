<script setup lang="ts">
import { computed, ref } from 'vue';
import { ntfySubscriptionUrl } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ topic: string | null }>();
const emit = defineEmits<{ saved: [] }>();

const api = useApi();
const busy = ref(false);
const error = ref<unknown>(null);
const link = computed(() => (props.topic === null ? null : ntfySubscriptionUrl(props.topic)));

async function change(action: () => Promise<unknown>): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await action();
    emit('saved');
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

const turnOn = () => change(() => api.generateNtfyTopic());
const regenerate = () => {
  if (!window.confirm(messages.ntfyAlerts.regenerateConfirm)) return Promise.resolve();
  return change(() => api.generateNtfyTopic());
};
const turnOff = () => change(() => api.clearNtfyTopic());
</script>

<template>
  <div class="panel" data-test="ntfy-alerts">
    <h2>{{ messages.ntfyAlerts.title }}</h2>
    <p class="muted">{{ messages.ntfyAlerts.hint }}</p>
    <template v-if="link">
      <p>
        <span class="muted">{{ messages.ntfyAlerts.link }}</span>
        <a :href="link" target="_blank" rel="noopener noreferrer" data-test="ntfy-link">{{
          link
        }}</a>
      </p>
      <p class="muted">{{ messages.ntfyAlerts.secret }}</p>
      <button type="button" data-test="ntfy-regenerate" :disabled="busy" @click="regenerate">
        {{ messages.ntfyAlerts.regenerate }}
      </button>
      <button type="button" data-test="ntfy-off" :disabled="busy" @click="turnOff">
        {{ messages.ntfyAlerts.turnOff }}
      </button>
    </template>
    <button v-else type="button" data-test="ntfy-on" :disabled="busy" @click="turnOn">
      {{ messages.ntfyAlerts.turnOn }}
    </button>
    <ErrorNotice :error="error" />
  </div>
</template>

<style scoped>
a {
  display: block;
  overflow-wrap: anywhere;
}
</style>
