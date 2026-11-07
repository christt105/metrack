<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PublicPage } from '@metrack/domain';
import { ApiRequestError } from '../api/ApiRequestError';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ page: PublicPage }>();
const emit = defineEmits<{ saved: [page: PublicPage] }>();

const api = useApi();
const handle = ref(props.page.handle ?? '');
const enabled = ref(props.page.enabled);
const busy = ref(false);
const saved = ref(false);
const error = ref<unknown>(null);

watch(
  () => props.page,
  (page) => {
    handle.value = page.handle ?? '';
    enabled.value = page.enabled;
  },
);

const known = computed(() =>
  error.value instanceof ApiRequestError
    ? (messages.publicPage.errors[error.value.code] ?? null)
    : null,
);
const base = computed(() => (props.page.handle ? `/u/${props.page.handle}/` : null));

async function save(): Promise<void> {
  busy.value = true;
  saved.value = false;
  error.value = null;
  try {
    const page = await api.updatePublicPage({
      handle: handle.value.trim(),
      enabled: enabled.value,
    });
    saved.value = true;
    emit('saved', page);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="panel">
    <h2>{{ messages.publicPage.title }}</h2>
    <p class="muted">{{ messages.publicPage.hint }}</p>
    <form class="public-page" @submit.prevent="save">
      <label>
        <span class="muted">{{ messages.publicPage.handle }}</span>
        <input v-model="handle" type="text" name="handle" maxlength="30" autocomplete="off" />
        <span class="muted hint">{{ messages.publicPage.handleHint }}</span>
      </label>
      <label class="check">
        <input v-model="enabled" type="checkbox" name="enabled" />
        <span>{{ messages.publicPage.enabled }}</span>
      </label>
      <button type="submit" :disabled="busy">{{ messages.publicPage.save }}</button>
    </form>
    <p v-if="saved" class="notice success" role="status">{{ messages.publicPage.saved }}</p>
    <p v-if="known" class="notice error" role="alert">{{ known }}</p>
    <ErrorNotice v-else :error="error" />
    <p v-if="page.enabled && base">
      <a :href="base" target="_blank" rel="noopener">{{ messages.publicPage.open }}</a>
      ·
      <a :href="`${base}feed.xml`" target="_blank" rel="noopener">{{ messages.publicPage.feed }}</a>
    </p>
  </div>
</template>

<style scoped>
.public-page {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.public-page label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}

.public-page .check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
}

.public-page button {
  justify-self: start;
}

.hint {
  font-size: 0.75rem;
}
</style>
