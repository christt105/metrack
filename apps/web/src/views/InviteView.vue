<script setup lang="ts">
import { computed } from 'vue';
import ErrorNotice from '../components/ErrorNotice.vue';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { messages } from '../i18n/messages';

const props = defineProps<{ code: string }>();
const api = useApi();
const { data: preview, error } = useLoader(() => api.invitePreview(props.code));
const signInHref = computed(
  () => `/api/auth/google/start?invite=${encodeURIComponent(props.code)}`,
);
</script>

<template>
  <section class="invite">
    <ErrorNotice :error="error" />
    <p v-if="!preview && !error" class="muted">{{ messages.invites.page.loading }}</p>
    <template v-else-if="preview">
      <h1>{{ messages.invites.page.title(preview.inviter) }}</h1>
      <p class="muted">{{ messages.invites.page.lead }}</p>
      <a v-if="preview.status === 'valid'" class="google" :href="signInHref">{{
        messages.invites.page.signIn
      }}</a>
      <p v-else class="notice error" role="alert" data-test="invite-problem">
        {{ messages.invites.page.problem[preview.status] }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.invite {
  max-width: 420px;
  margin: 0 auto;
}

.google {
  display: block;
  margin: 16px 0;
  padding: 10px 12px;
  border: 1px solid currentColor;
  border-radius: 4px;
  text-align: center;
  text-decoration: none;
}
</style>
