<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { MediaPage } from '@metrack/domain';
import ContinueCard from '../components/ContinueCard.vue';
import ErrorNotice from '../components/ErrorNotice.vue';
import LibraryFilters from '../components/LibraryFilters.vue';
import LibraryWelcome from '../components/LibraryWelcome.vue';
import MediaCard from '../components/MediaCard.vue';
import { useApi } from '../composables/useApi';
import { useLibraryCache } from '../composables/useLibraryCache';
import { messages } from '../i18n/messages';
import { buildCards } from '../logic/buildCards';
import {
  filtersFromQuery,
  filtersToMediaQuery,
  filtersToQuery,
  hasNarrowing,
} from '../logic/filterQuery';

const api = useApi();
const cache = useLibraryCache();
const route = useRoute();
const router = useRouter();

const filters = ref(filtersFromQuery(route.query));
const initial = cache.get(filtersToMediaQuery(filters.value)) ?? null;
const page = ref<MediaPage | null>(initial);
const error = ref<unknown>(null);
const loading = ref(false);
const libraryEmpty = ref(initial !== null && initial.total === 0 && !hasNarrowing(filters.value));
let ticket = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

const cards = computed(() =>
  page.value ? buildCards(page.value.items, filters.value.type, filters.value.sort) : [],
);
const inProgress = computed(() =>
  hasNarrowing(filters.value) ? [] : cards.value.filter((card) => card.status === 'in_progress'),
);

async function load(): Promise<void> {
  const mine = ++ticket;
  loading.value = true;
  try {
    const query = filtersToMediaQuery(filters.value);
    const result = await api.listMedia(query);
    cache.set(query, result);
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
    const cached = cache.get(filtersToMediaQuery(filters.value));
    if (cached) {
      page.value = cached;
      libraryEmpty.value = cached.total === 0 && !hasNarrowing(filters.value);
    }
    timer = setTimeout(load, 200);
  },
  { deep: true },
);

onMounted(load);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <section>
    <header class="head">
      <h1>{{ messages.nav.library }}</h1>
      <p v-if="page && !error && !libraryEmpty" class="count">
        {{ messages.list.count(cards.length) }}
        <template v-if="page.total > page.items.length">
          {{ messages.list.truncated(page.items.length, page.total) }}
        </template>
      </p>
    </header>
    <ErrorNotice :error="error" />
    <LibraryWelcome v-if="page && !error && libraryEmpty" />
    <p v-else-if="!page && !error" class="muted">{{ messages.common.loading }}</p>
    <template v-else-if="page">
      <section v-if="inProgress.length" class="shelf" aria-labelledby="shelf-progress">
        <h2 id="shelf-progress">{{ messages.list.inProgressTitle }}</h2>
        <div class="rail">
          <ContinueCard v-for="card in inProgress" :key="`progress-${card.key}`" :card="card" />
        </div>
      </section>
      <LibraryFilters v-model="filters" />
      <p v-if="cards.length === 0 && !loading" class="muted">{{ messages.list.empty }}</p>
      <div class="grid">
        <MediaCard v-for="card in cards" :key="card.key" :card="card" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s-1) var(--s-4);
  margin-bottom: var(--s-5);
}

.head h1 {
  margin: 0;
}

.count {
  margin: 0;
  color: var(--muted);
  font-size: var(--t-small);
}

.shelf {
  margin-bottom: var(--s-6);
}

.rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(300px, calc((100% - 2 * var(--s-4)) / 3));
  gap: var(--s-4);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: var(--gut);
  scrollbar-width: thin;
  margin: 0 calc(var(--gut) * -1);
  padding: 4px var(--gut) var(--s-3);
}

.rail > * {
  scroll-snap-align: start;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--s-6) var(--s-4);
}

@media (max-width: 759px) {
  .rail {
    grid-auto-columns: 82%;
    gap: var(--s-3);
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--s-5) var(--s-3);
  }
}

@media (min-width: 480px) and (max-width: 759px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1100px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
  }
}
</style>
