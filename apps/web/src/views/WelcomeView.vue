<script setup lang="ts">
import { computed, ref } from 'vue';
import { handleProblem, normalizeHandle } from '@metrack/domain';
import { useRouter } from 'vue-router';
import ErrorNotice from '../components/ErrorNotice.vue';
import { useApi } from '../composables/useApi';
import { useSession } from '../composables/useSession';
import { useMessages } from '../composables/useMessages';
import { ApiRequestError } from '../api/ApiRequestError';
import { suggestHandle } from '../logic/suggestHandle';

const messages = useMessages();
const api = useApi();
const session = useSession();
const router = useRouter();
const name = ref(session.user.value?.name ?? '');
const handle = ref(suggestHandle(name.value));
const busy = ref(false);
const error = ref<unknown>(null);
const problem = computed(() => {
  const wanted = normalizeHandle(handle.value);
  return wanted === '' ? null : handleProblem(wanted);
});
const taken = computed(
  () => error.value instanceof ApiRequestError && error.value.code === 'handle_taken',
);

async function submit(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    session.welcomed(
      await api.completeWelcome({ name: name.value.trim(), handle: handle.value.trim() }),
    );
    await router.replace({ name: 'library' });
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="welcome">
    <h1>{{ messages.welcome.title }}</h1>
    <p class="muted">{{ messages.welcome.hint }}</p>
    <form @submit.prevent="submit">
      <label>
        <span class="muted">{{ messages.welcome.name }}</span>
        <input v-model="name" type="text" name="name" maxlength="80" required autocomplete="name" />
      </label>
      <label>
        <span class="muted">{{ messages.welcome.handle }}</span>
        <input
          v-model="handle"
          type="text"
          name="handle"
          maxlength="30"
          required
          autocomplete="off"
          autocapitalize="none"
        />
        <span class="muted hint">{{ messages.welcome.handleHint }}</span>
        <span v-if="problem" class="hint problem" data-test="handle-problem">{{
          messages.welcome.handleProblem(problem)
        }}</span>
      </label>
      <p v-if="taken" class="notice error" role="alert">
        {{ messages.welcome.errors.handle_taken }}
      </p>
      <ErrorNotice v-else :error="error" />
      <button
        type="submit"
        :disabled="busy || name.trim() === '' || problem !== null || handle.trim() === ''"
      >
        {{ messages.welcome.submit }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.welcome {
  max-width: 420px;
  margin: 0 auto;
}

form {
  display: grid;
  gap: 12px;
}

label {
  display: grid;
  gap: 4px;
}

.hint {
  font-size: 0.85rem;
}

.problem {
  color: var(--danger);
}
</style>
