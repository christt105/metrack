<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ collection: 'games' | 'books' }>();

const api = useApi();
const router = useRouter();
const title = ref('');
const busy = ref(false);
const error = ref<unknown>(null);

async function create(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const created = await api.create(props.collection, { title: title.value.trim() });
    await router.push(`/${props.collection}/${created.id}`);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="panel">
    <h2>{{ messages.search.manualHeading }}</h2>
    <p class="muted">{{ messages.search.manualHint }}</p>
    <form class="row" @submit.prevent="create">
      <input
        v-model="title"
        type="text"
        required
        class="title"
        :placeholder="messages.search.manualTitle"
        :aria-label="messages.search.manualTitle"
      />
      <button type="submit" class="primary" :disabled="busy || !title.trim()">
        {{ messages.search.create }}
      </button>
    </form>
    <ErrorNotice :error="error" />
  </section>
</template>

<style scoped>
.title {
  flex: 1;
  min-width: 180px;
  width: auto;
}
</style>
