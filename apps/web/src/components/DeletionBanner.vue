<script setup lang="ts">
import { computed, ref } from 'vue';
import { useApi } from '../composables/useApi';
import { useSession } from '../composables/useSession';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const api = useApi();
const session = useSession();
const busy = ref(false);
const error = ref<unknown>(null);
const when = computed(() => session.deletion.value?.deleteAt.slice(0, 10) ?? '');

async function cancel(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    session.setDeletion((await api.cancelAccountDeletion()).deletion);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="session.deletion.value" class="notice error banner" role="status">
    <span>{{ messages.account.banner(when) }}</span>
    <button type="button" :disabled="busy" @click="cancel">{{ messages.account.cancel }}</button>
    <ErrorNotice :error="error" />
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin: 0;
  border-radius: 0;
}
</style>
