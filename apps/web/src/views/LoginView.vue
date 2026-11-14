<script setup lang="ts">
import { computed, ref } from 'vue';
import type { User } from '@metrack/domain';
import { useRoute, useRouter } from 'vue-router';
import ErrorNotice from '../components/ErrorNotice.vue';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { useSession } from '../composables/useSession';
import { messages } from '../i18n/messages';
import { safeNext } from '../logic/safeNext';

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
  <section class="login">
    <h1>{{ messages.login.title }}</h1>
    <ErrorNotice :error="error" />
    <ErrorNotice :error="signInError" />
    <p v-if="googleError" class="notice error" role="alert">{{ googleError }}</p>
    <a v-if="googleAvailable" class="google" href="/api/auth/google/start">{{
      messages.login.googleButton
    }}</a>
    <p v-if="loading && users === null" class="muted">{{ messages.common.loading }}</p>
    <template v-else-if="users">
      <p class="muted">{{ messages.login.devHint }}</p>
      <ul>
        <li v-for="user in users" :key="user.id">
          <button type="button" :disabled="busy" @click="signIn(user)">
            {{ user.name }}
            <span v-if="user.email" class="muted">{{ user.email }}</span>
          </button>
        </li>
      </ul>
    </template>
    <form class="token" @submit.prevent="signInWithToken">
      <h2>{{ messages.login.tokenTitle }}</h2>
      <p class="muted">{{ messages.login.tokenHint }}</p>
      <label>
        {{ messages.login.tokenLabel }}
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
  </section>
</template>

<style scoped>
.login {
  max-width: 420px;
}

ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

ul button {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
}

.google {
  display: block;
  margin: 12px 0;
  padding: 8px 12px;
  border: 1px solid currentColor;
  border-radius: 4px;
  text-align: center;
  text-decoration: none;
}

.token {
  display: grid;
  gap: 8px;
  margin-top: 24px;
}

.token label {
  display: grid;
  gap: 4px;
}
</style>
