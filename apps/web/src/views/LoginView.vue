<script setup lang="ts">
import { ref } from 'vue';
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
</script>

<template>
  <section class="login">
    <h1>{{ messages.login.title }}</h1>
    <ErrorNotice :error="error" />
    <ErrorNotice :error="signInError" />
    <p v-if="loading && users === null" class="muted">{{ messages.common.loading }}</p>
    <p v-else-if="!error && users === null" class="muted">{{ messages.login.noMethod }}</p>
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

button {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
}
</style>
