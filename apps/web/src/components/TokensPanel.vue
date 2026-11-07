<script setup lang="ts">
import { reactive, ref } from 'vue';
import {
  TOKEN_LIFETIMES_DAYS,
  TOKEN_NAME_MAX,
  TOKEN_SCOPES,
  type ApiToken,
  type CreateTokenRequest,
} from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const api = useApi();
const { data: tokens, error: loadError, reload } = useLoader(() => api.listTokens());
const draft = reactive<CreateTokenRequest>({ name: '', scope: 'read', expiresInDays: 90 });
const secret = ref<string | null>(null);
const copied = ref(false);
const error = ref<unknown>(null);
const busy = ref(false);

const day = (iso: string | null): string | null => iso?.slice(0, 10) ?? null;
const details = (token: ApiToken): string =>
  messages.tokens.details(
    messages.tokens.scopeLabels[token.scope],
    day(token.createdAt) ?? '',
    day(token.expiresAt),
    day(token.lastUsedAt),
  );

async function act(action: () => Promise<void>): Promise<void> {
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

const create = () =>
  act(async () => {
    const created = await api.createToken({ ...draft });
    secret.value = created.secret;
    copied.value = false;
    draft.name = '';
  });

const revoke = (token: ApiToken) => {
  if (!window.confirm(messages.tokens.revokeConfirm(token.name))) return Promise.resolve();
  return act(() => api.revokeToken(token.id));
};

async function copy(): Promise<void> {
  if (secret.value === null) return;
  await navigator.clipboard.writeText(secret.value);
  copied.value = true;
}
</script>

<template>
  <div class="panel">
    <h2>{{ messages.tokens.title }}</h2>
    <p class="muted">{{ messages.tokens.hint }}</p>
    <ErrorNotice :error="loadError" />
    <p v-if="tokens && tokens.length === 0" class="muted">{{ messages.tokens.empty }}</p>
    <ul v-if="tokens && tokens.length > 0" class="tokens">
      <li v-for="token in tokens" :key="token.id">
        <div>
          <strong>{{ token.name }}</strong>
          <span class="muted">{{ details(token) }}</span>
        </div>
        <button type="button" :disabled="busy" @click="revoke(token)">
          {{ messages.tokens.revoke }}
        </button>
      </li>
    </ul>
    <div v-if="secret" class="notice success secret" role="status">
      <span>{{ messages.tokens.created }}</span>
      <code>{{ secret }}</code>
      <button type="button" @click="copy">
        {{ copied ? messages.tokens.copied : messages.tokens.copy }}
      </button>
    </div>
    <form class="create" @submit.prevent="create">
      <label>
        <span class="muted">{{ messages.tokens.name }}</span>
        <input v-model="draft.name" type="text" name="name" required :maxlength="TOKEN_NAME_MAX" />
      </label>
      <label>
        <span class="muted">{{ messages.tokens.scope }}</span>
        <select v-model="draft.scope" name="scope">
          <option v-for="scope in TOKEN_SCOPES" :key="scope" :value="scope">
            {{ messages.tokens.scopeLabels[scope] }}
          </option>
        </select>
      </label>
      <label>
        <span class="muted">{{ messages.tokens.lifetime }}</span>
        <select v-model="draft.expiresInDays" name="expiresInDays">
          <option v-for="days in TOKEN_LIFETIMES_DAYS" :key="String(days)" :value="days">
            {{ messages.tokens.lifetimeLabel(days) }}
          </option>
        </select>
      </label>
      <button type="submit" :disabled="busy">{{ messages.tokens.create }}</button>
    </form>
    <ErrorNotice :error="error" />
  </div>
</template>

<style scoped>
.tokens {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
  display: grid;
  gap: 8px;
}

.tokens li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.tokens li div {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}

.tokens .muted {
  font-size: 0.8rem;
}

.secret {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.secret code {
  overflow-wrap: anywhere;
  user-select: all;
}

.secret button {
  justify-self: start;
}

.create {
  display: grid;
  gap: 10px;
}

.create label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}

.create button {
  justify-self: start;
}

@media (min-width: 760px) {
  .create {
    grid-template-columns: 2fr 1fr 1fr auto;
    align-items: end;
  }
}
</style>
