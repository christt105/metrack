<script setup lang="ts">
import ErrorNotice from '../components/ErrorNotice.vue';
import UnlinkedRow from '../components/UnlinkedRow.vue';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { messages } from '../i18n/messages';

const api = useApi();
const { data, error, loading, reload } = useLoader(() => api.listUnlinked());
</script>

<template>
  <section>
    <h1>{{ messages.unlinked.title }}</h1>
    <ErrorNotice :error="error" />
    <p v-if="loading && !data" class="muted">{{ messages.common.loading }}</p>
    <p v-else-if="data && data.length === 0" class="muted">{{ messages.unlinked.empty }}</p>
    <UnlinkedRow v-for="title in data ?? []" :key="title.id" :title="title" @gone="reload" />
  </section>
</template>
