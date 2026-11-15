<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { MediaPage } from '@metrack/domain';
import ErrorNotice from '../components/ErrorNotice.vue';
import LibraryFilters from '../components/LibraryFilters.vue';
import LibraryWelcome from '../components/LibraryWelcome.vue';
import MediaCard from '../components/MediaCard.vue';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import { buildCards } from '../logic/buildCards';
import {
  filtersFromQuery,
  filtersToMediaQuery,
  filtersToQuery,
  hasNarrowing,
} from '../logic/filterQuery';

const api = useApi();
const route = useRoute();
const router = useRouter();

const filters = ref(filtersFromQuery(route.query));
const page = ref<MediaPage | null>(null);
const error = ref<unknown>(null);
const loading = ref(false);
const libraryEmpty = ref(false);
let ticket = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

const cards = computed(() =>
  page.value ? buildCards(page.value.items, filters.value.type, filters.value.sort) : [],
);

async function load(): Promise<void> {
  const mine = ++ticket;
  loading.value = true;
  try {
    const result = await api.listMedia(filtersToMediaQuery(filters.value));
    if (mine !== ticket) return;
    page.value = result;
    libraryEmpty.value = result.total === 0 && !hasNarrowing(filters.value);
    error.value = null;
  } catch (cause) {
    if (mine === ticket) error.value = cause;
  } finally {
    if (mine === ticket) loading.value = false;
  }
}

watch(
  filters,
  () => {
    void router.replace({ query: filtersToQuery(filters.value) });
    clearTimeout(timer);
    timer = setTimeout(load, 200);
  },
  { deep: true },
);

onMounted(load);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <section>
    <h1>{{ messages.nav.library }}</h1>
    <ErrorNotice :error="error" />
    <LibraryWelcome v-if="page && !error && libraryEmpty" />
    <template v-else>
      <LibraryFilters v-model="filters" />
      <p v-if="page && !error" class="muted count">
        {{ messages.list.count(cards.length) }}
        <template v-if="page.total > page.items.length">
          {{ messages.list.truncated(page.items.length, page.total) }}
        </template>
      </p>
      <p v-if="loading && !page" class="muted">{{ messages.common.loading }}</p>
      <p v-else-if="page && cards.length === 0" class="muted">{{ messages.list.empty }}</p>
      <div class="grid">
        <MediaCard v-for="card in cards" :key="card.key" :card="card" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.count {
  margin: 0 0 12px;
  font-size: 0.85rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 18px 14px;
}

@media (min-width: 760px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
}
</style>
