<script setup lang="ts">
import { computed } from 'vue';
import AuthLayout from '../components/AuthLayout.vue';
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
  <AuthLayout>
    <ErrorNotice :error="error" />
    <p v-if="!preview && !error" class="muted">{{ messages.invites.page.loading }}</p>
    <template v-else-if="preview">
      <h1 class="title">{{ messages.invites.page.title(preview.inviter) }}</h1>
      <p class="lead">{{ messages.landing.lead }}</p>
      <a v-if="preview.status === 'valid'" class="google" :href="signInHref">{{
        messages.invites.page.signIn
      }}</a>
      <p v-else class="notice error" role="alert" data-test="invite-problem">
        {{ messages.invites.page.problem[preview.status] }}
      </p>
    </template>
  </AuthLayout>
</template>

<style scoped>
.title {
  font-size: clamp(32px, 2.6vw + 16px, 52px);
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.lead {
  max-width: 44ch;
  margin-bottom: var(--s-6);
  font-size: 18px;
  line-height: 1.6;
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
}

.google:hover {
  background: var(--primary-hover);
  text-decoration: none;
}
</style>
