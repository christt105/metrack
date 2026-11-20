<script setup lang="ts">
import { ref } from 'vue';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import ErrorNotice from './ErrorNotice.vue';

const messages = useMessages();
const props = defineProps<{ steamId: string | null; canImport: boolean }>();
const emit = defineEmits<{ saved: [] }>();

const api = useApi();
const typed = ref(props.steamId ?? '');
const busy = ref(false);
const error = ref<unknown>(null);
const saved = ref(false);

async function save(): Promise<void> {
  busy.value = true;
  error.value = null;
  saved.value = false;
  try {
    const settings = await api.updateSteamId(typed.value.trim() === '' ? null : typed.value);
    typed.value = settings.steamId ?? '';
    saved.value = true;
    emit('saved');
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="panel" data-test="steam">
    <h2>{{ messages.steam.title }}</h2>
    <p class="muted">{{ messages.steam.hint }}</p>
    <form @submit.prevent="save">
      <label>
        {{ messages.steam.account }}
        <input v-model="typed" name="steamId" data-test="steam-input" :disabled="busy" />
      </label>
      <button type="submit" :disabled="busy" data-test="steam-save">
        {{ messages.common.save }}
      </button>
      <span v-if="saved" class="muted">{{ messages.common.saved }}</span>
    </form>
    <p v-if="props.steamId && canImport">
      <RouterLink :to="{ name: 'steam' }" data-test="steam-import-link">
        {{ messages.steam.importLink }}
      </RouterLink>
    </p>
    <p v-else-if="props.steamId" class="muted">{{ messages.steam.notConfigured }}</p>
    <ErrorNotice :error="error" />
  </div>
</template>
