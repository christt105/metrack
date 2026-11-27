<script setup lang="ts">
import { ref } from 'vue';
import type { Language } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import { useSession } from '../composables/useSession';
import ErrorNotice from './ErrorNotice.vue';

const messages = useMessages();
const props = defineProps<{ language: Language | null }>();

const api = useApi();
const session = useSession();
const current = ref<Language | null>(props.language);
const busy = ref(false);
const error = ref<unknown>(null);

async function choose(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value;
  const language = value === 'es' || value === 'en' ? value : null;
  busy.value = true;
  error.value = null;
  try {
    const saved = await api.settings.updateLanguage(language);
    current.value = saved.language;
    session.setLanguage(saved.language);
  } catch (cause) {
    error.value = cause;
    (event.target as HTMLSelectElement).value = current.value ?? '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="panel" data-test="language">
    <h2>{{ messages.languagePanel.title }}</h2>
    <p class="muted">{{ messages.languagePanel.hint }}</p>
    <label>
      {{ messages.languagePanel.label }}
      <select
        name="language"
        data-test="language-select"
        :value="current ?? ''"
        :disabled="busy"
        @change="choose"
      >
        <option value="">{{ messages.languagePanel.automatic }}</option>
        <option value="es">{{ messages.languagePanel.spanish }}</option>
        <option value="en">{{ messages.languagePanel.english }}</option>
      </select>
    </label>
    <ErrorNotice :error="error" />
  </div>
</template>
