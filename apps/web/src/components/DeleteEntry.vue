<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Collection } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import AppIcon from './AppIcon.vue';
import ErrorNotice from './ErrorNotice.vue';

const messages = useMessages();
const props = defineProps<{
  collection: Collection;
  id: number;
  title: string;
  redirectTo: string;
}>();

const api = useApi();
const router = useRouter();
const asking = ref(false);
const busy = ref(false);
const error = ref<unknown>(null);

async function confirm(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await api.library.remove(props.collection, props.id);
    await router.replace(props.redirectTo);
  } catch (cause) {
    error.value = cause;
    busy.value = false;
  }
}
</script>

<template>
  <div class="delete">
    <button v-if="!asking" type="button" class="danger" @click="asking = true">
      <AppIcon name="trash" :size="18" />
      {{ messages.manage.delete(title) }}
    </button>
    <div v-else class="warning" role="alert">
      <p>{{ messages.manage.deleteWarning(collection === 'series') }}</p>
      <div class="row">
        <button type="button" class="danger" :disabled="busy" @click="confirm">
          <AppIcon name="trash" :size="18" />
          {{ messages.manage.deleteConfirm }}
        </button>
        <button type="button" :disabled="busy" @click="asking = false">
          {{ messages.common.cancel }}
        </button>
      </div>
    </div>
    <ErrorNotice :error="error" />
  </div>
</template>

<style scoped>
.warning p {
  margin: 0 0 var(--s-3);
}
</style>
