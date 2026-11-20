<script setup lang="ts">
import { computed, ref } from 'vue';
import type { User } from '@metrack/domain';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '../components/AuthLayout.vue';
import ErrorNotice from '../components/ErrorNotice.vue';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { useSession } from '../composables/useSession';
import { useMessages } from '../composables/useMessages';
import { safeNext } from '../logic/safeNext';

const messages = useMessages();
const api = useApi();
const session = useSession();
const route = useRoute();
const router = useRouter();
const { data: users, error, loading } = useLoader(() => api.devUsers());
const busy = ref(false);
const signInError = ref<unknown>(null);
const accessToken = ref('');
const { data: googleAvailable } = useLoader(async () => {
  try {
    return (await api.health()).features.googleLogin;
  } catch {
    return false;
  }
});
const googleError = computed(() => {
  const code = route.query.error;
  if (code === 'google_no_account') return messages.login.googleNoAccount;
  return code === 'google_failed' ? messages.login.googleFailed : null;
});

async function signIn(user: User): Promise<void> {
  busy.value = true;
  signInError.value = null;
  try {
    session.signedIn(await api.devLogin(user.id));
    await router.replace(safeNext(route.query.next));
  } catch (cause) {
    signInError.value = cause;
  } finally {
    busy.value = false;
  }
}

async function signInWithToken(): Promise<void> {
  busy.value = true;
  signInError.value = null;
  try {
    session.signedIn(await api.tokenLogin(accessToken.value.trim()));
    accessToken.value = '';
    await router.replace(safeNext(route.query.next));
  } catch (cause) {
    signInError.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <h1 class="title">{{ messages.landing.title }}</h1>
    <p class="lead">{{ messages.landing.lead }}</p>
    <p class="lead google-note" data-test="google-note">{{ messages.landing.googleNote }}</p>
    <ErrorNotice :error="error" />
    <ErrorNotice :error="signInError" />
    <p v-if="googleError" class="notice error" role="alert">{{ googleError }}</p>
    <div class="actions">
      <a v-if="googleAvailable" class="google" href="/api/auth/google/start">{{
        messages.login.googleButton
      }}</a>
      <p v-if="loading && users === null" class="muted">{{ messages.common.loading }}</p>
      <template v-else-if="users">
        <p class="hint">{{ messages.login.devHint }}</p>
        <ul class="users">
          <li v-for="user in users" :key="user.id">
            <button type="button" :disabled="busy" @click="signIn(user)">
              {{ user.name }}
              <span v-if="user.email" class="muted">{{ user.email }}</span>
            </button>
          </li>
        </ul>
      </template>
    </div>
    <details class="other" :open="!googleAvailable && !users">
      <summary>{{ messages.landing.otherWays }}</summary>
      <form class="token" @submit.prevent="signInWithToken">
        <h2>{{ messages.login.tokenTitle }}</h2>
        <p class="hint">{{ messages.login.tokenHint }}</p>
        <label>
          <span class="label">{{ messages.login.tokenLabel }}</span>
          <input
            v-model="accessToken"
            type="password"
            autocomplete="off"
            spellcheck="false"
            required
          />
        </label>
        <button type="submit" :disabled="busy || accessToken.trim() === ''">
          {{ messages.login.tokenSubmit }}
        </button>
      </form>
    </details>
    <p class="access">{{ messages.landing.access }}</p>
  </AuthLayout>
</template>

<style scoped>
.title {
  font-size: clamp(36px, 3.4vw + 16px, 64px);
  letter-spacing: -0.04em;
  line-height: 1.02;
  margin-bottom: var(--s-5);
  animation: rise 700ms var(--ease-enter) both;
}

.lead {
  max-width: 44ch;
  margin-bottom: var(--s-6);
  color: var(--on-surface);
  font-size: 18px;
  line-height: 1.6;
  animation: fade-up 600ms var(--ease-enter) 160ms both;
}

.actions {
  display: grid;
  gap: var(--s-3);
  animation: fade-up 600ms var(--ease-enter) 240ms both;
}

.google {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 24px;
  border-radius: var(--r-btn);
  background: var(--primary);
  color: var(--on-primary);
  font-weight: 500;
  transition:
    background-color var(--m-out) var(--ease),
    transform var(--m-out) var(--ease);
}

.google:hover {
  background: var(--primary-hover);
  text-decoration: none;
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: var(--t-small);
}

.users {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.users button {
  justify-content: space-between;
  width: 100%;
  min-height: 48px;
  text-align: left;
}

.other {
  margin-top: var(--s-5);
  border-top: 1px solid var(--outline);
  padding-top: var(--s-4);
}

.other summary {
  color: var(--muted);
  font-size: var(--t-small);
  font-weight: 500;
}

.token {
  display: grid;
  gap: var(--s-3);
  margin-top: var(--s-4);
}

.token h2 {
  margin: 0;
  font-size: 17px;
}

.token label {
  display: grid;
  gap: 4px;
}

.label {
  color: var(--muted);
  font-size: var(--t-label);
  font-weight: 500;
}

.access {
  margin-top: var(--s-5);
  color: var(--muted);
  font-size: var(--t-small);
}

@media (hover: hover) and (pointer: fine) {
  .google:hover {
    transform: translateY(-1px);
  }

  .google:active {
    transform: translateY(1px) scale(0.985);
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
</style>
