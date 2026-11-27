<script setup lang="ts">
import { computed, ref } from 'vue';
import { ntfyAppUrl, ntfySubscriptionUrl } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import ErrorNotice from './ErrorNotice.vue';

const messages = useMessages();
const props = defineProps<{ topic: string | null }>();
const emit = defineEmits<{ saved: [] }>();

const api = useApi();
const busy = ref(false);
const error = ref<unknown>(null);
const copied = ref(false);
const copyFailed = ref(false);
const appLink = computed(() => (props.topic === null ? null : ntfyAppUrl(props.topic)));
const link = computed(() => (props.topic === null ? null : ntfySubscriptionUrl(props.topic)));

async function copy(): Promise<void> {
  if (props.topic === null) return;
  copied.value = false;
  copyFailed.value = false;
  try {
    await navigator.clipboard.writeText(props.topic);
    copied.value = true;
  } catch {
    copyFailed.value = true;
  }
}

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

const turnOn = () => change(() => api.settings.generateNtfyTopic());
const regenerate = () => {
  if (!window.confirm(messages.ntfyAlerts.regenerateConfirm)) return Promise.resolve();
  return change(() => api.settings.generateNtfyTopic());
};
const turnOff = () => change(() => api.settings.clearNtfyTopic());
</script>

<template>
  <div class="panel" data-test="ntfy-alerts">
    <h2>{{ messages.ntfyAlerts.title }}</h2>
    <p class="muted">{{ messages.ntfyAlerts.hint }}</p>
    <template v-if="link">
      <p class="muted">{{ messages.ntfyAlerts.android }}</p>
      <a :href="appLink ?? undefined" data-test="ntfy-app-link">{{
        messages.ntfyAlerts.openInApp
      }}</a>
      <p class="muted">{{ messages.ntfyAlerts.iphone }}</p>
      <p>
        <span class="muted">{{ messages.ntfyAlerts.topicLabel }}</span>
        <code data-test="ntfy-topic">{{ topic }}</code>
      </p>
      <button type="button" data-test="ntfy-copy" @click="copy">
        {{ copied ? messages.ntfyAlerts.copied : messages.ntfyAlerts.copy }}
      </button>
      <p v-if="copyFailed" class="muted" data-test="ntfy-copy-failed">
        {{ messages.ntfyAlerts.copyFailed }}
      </p>
      <a :href="link" target="_blank" rel="noopener noreferrer" data-test="ntfy-link">{{
        messages.ntfyAlerts.browser
      }}</a>
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
a,
code {
  display: block;
  margin: 0.5rem 0;
  overflow-wrap: anywhere;
}
</style>
