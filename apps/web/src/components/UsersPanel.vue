<script setup lang="ts">
import { ref } from 'vue';
import type { UserSummary } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { useMessages } from '../composables/useMessages';
import ErrorNotice from './ErrorNotice.vue';

const messages = useMessages();
const api = useApi();
const { data: users, error: loadError, reload } = useLoader(() => api.admin.listUserSummaries());
const error = ref<unknown>(null);
const busy = ref(false);

const day = (iso: string): string => iso.slice(0, 10);

async function act(action: () => Promise<unknown>): Promise<void> {
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

const remove = (user: UserSummary) => {
  if (!window.confirm(messages.users.deleteConfirm(user.name))) return Promise.resolve();
  return act(() => api.admin.scheduleUserDeletion(user.id));
};

const cancel = (user: UserSummary) => act(() => api.admin.cancelUserDeletion(user.id));
</script>

<template>
  <div class="panel">
    <h2>{{ messages.users.title }}</h2>
    <p class="muted">{{ messages.users.hint }}</p>
    <ErrorNotice :error="loadError" />
    <ErrorNotice :error="error" />
    <ul v-if="users" class="accounts">
      <li v-for="user in users" :key="user.id" data-test="account">
        <div>
          <strong>{{ user.name }}</strong>
          <span class="muted">{{ user.email ?? messages.users.noEmail }}</span>
          <span class="muted">
            {{ messages.users.joined }} {{ day(user.createdAt) }} · {{ messages.users.storage }}
            {{ messages.images.megabytes(user.usedBytes) }}
          </span>
          <span v-if="user.deletion" class="muted warn">
            {{ messages.users.scheduled(day(user.deletion.deleteAt)) }}
          </span>
        </div>
        <template v-if="user.id !== 1">
          <button v-if="user.deletion" type="button" :disabled="busy" @click="cancel(user)">
            {{ messages.users.cancel }}
          </button>
          <button v-else type="button" class="danger" :disabled="busy" @click="remove(user)">
            {{ messages.users.delete }}
          </button>
        </template>
        <span v-else class="muted">{{ messages.users.owner }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.accounts {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.accounts li {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.accounts li div {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}

.accounts .muted {
  font-size: 0.8rem;
}

.warn {
  color: var(--warning);
}
</style>
