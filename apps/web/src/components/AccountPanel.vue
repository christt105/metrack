<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AccountStatus } from '@metrack/domain';
import { ApiRequestError } from '../api/ApiRequestError';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { useSession } from '../composables/useSession';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ handle: string | null }>();

const api = useApi();
const session = useSession();
const { data: status, error: loadError, reload } = useLoader(() => api.accountStatus());
const confirm = ref('');
const busy = ref(false);
const error = ref<unknown>(null);

const deletion = computed(() => session.deletion.value ?? status.value?.deletion ?? null);
const when = computed(() => (deletion.value ? deletion.value.deleteAt.slice(0, 10) : ''));
const known = computed(() =>
  error.value instanceof ApiRequestError
    ? (messages.account.errors[error.value.code] ?? null)
    : null,
);

async function act(action: () => Promise<AccountStatus | void>): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await action();
    await reload();
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

const requestDeletion = () =>
  act(async () => {
    session.setDeletion(await api.requestAccountDeletion(confirm.value));
    confirm.value = '';
  });

const cancelDeletion = () =>
  act(async () => {
    session.setDeletion((await api.cancelAccountDeletion()).deletion);
  });
</script>

<template>
  <div class="panel">
    <h2>{{ messages.account.title }}</h2>
    <p class="muted">{{ messages.account.hint }}</p>
    <p>
      <a href="/api/account/export" download data-test="export">
        {{ messages.account.export }}
      </a>
    </p>
    <p class="muted">{{ messages.account.exportHint }}</p>
    <h3>{{ messages.account.deleteTitle }}</h3>
    <ErrorNotice :error="loadError" />
    <p v-if="status && !status.canDelete" class="muted">{{ messages.account.ownerHint }}</p>
    <template v-else-if="status">
      <p class="muted">{{ messages.account.deleteHint }}</p>
      <template v-if="deletion">
        <p class="notice error" role="status">{{ messages.account.scheduled(when) }}</p>
        <button type="button" :disabled="busy" @click="cancelDeletion">
          {{ messages.account.cancel }}
        </button>
      </template>
      <form v-else class="delete" @submit.prevent="requestDeletion">
        <label>
          <span class="muted">{{ messages.account.confirmLabel(props.handle) }}</span>
          <input v-model="confirm" type="text" name="confirm" autocomplete="off" required />
        </label>
        <button type="submit" :disabled="busy || confirm.trim() === ''">
          {{ messages.account.delete }}
        </button>
      </form>
    </template>
    <p v-if="known" class="notice error" role="alert">{{ known }}</p>
    <ErrorNotice v-else :error="error" />
  </div>
</template>

<style scoped>
.delete {
  display: grid;
  gap: 10px;
  max-width: 420px;
}

.delete label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}

.delete button {
  justify-self: start;
}
</style>
