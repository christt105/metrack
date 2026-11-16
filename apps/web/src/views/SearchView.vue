<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { SEARCHABLE_TYPES } from '@metrack/domain';
import type { SearchResult, SearchableType } from '@metrack/domain';
import { ApiRequestError } from '../api/ApiRequestError';
import ErrorNotice from '../components/ErrorNotice.vue';
import ManualAddForm from '../components/ManualAddForm.vue';
import SearchResultCard from '../components/SearchResultCard.vue';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import { detailPath } from '../logic/mediaRoutes';

const api = useApi();
const router = useRouter();
const type = ref<SearchableType>('movie');
const q = ref('');
const year = ref('');
const results = ref<SearchResult[] | null>(null);
const searching = ref(false);
const adding = ref(false);
const error = ref<unknown>(null);

const manualCollection = computed(() =>
  type.value === 'videogame' ? 'games' : type.value === 'book' ? 'books' : null,
);

async function search(): Promise<void> {
  searching.value = true;
  error.value = null;
  results.value = null;
  try {
    const yearNumber = year.value ? Number(year.value) : undefined;
    results.value = (await api.search(type.value, q.value.trim(), yearNumber)).results;
  } catch (cause) {
    error.value = cause;
  } finally {
    searching.value = false;
  }
}

async function add(result: SearchResult): Promise<void> {
  adding.value = true;
  error.value = null;
  try {
    const ref = await api.addTitle({ type: result.type, externalId: result.externalId });
    await router.push(detailPath(ref.type, ref.id));
  } catch (cause) {
    if (cause instanceof ApiRequestError && cause.code === 'already_added') {
      const existing = (cause.details as { existingId?: number } | undefined)?.existingId;
      if (existing !== undefined) result.existingId = existing;
    }
    error.value = cause;
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <section>
    <h1>{{ messages.search.title }}</h1>
    <form class="form" role="search" @submit.prevent="search">
      <div class="types" role="group" :aria-label="messages.list.type">
        <button
          v-for="option in SEARCHABLE_TYPES"
          :key="option"
          type="button"
          class="chip"
          :aria-pressed="type === option"
          @click="type = option"
        >
          {{ messages.typeLabels[option] }}
        </button>
      </div>
      <input
        v-model="year"
        type="number"
        min="1800"
        max="2200"
        class="year"
        :placeholder="messages.search.year"
        :aria-label="messages.search.year"
      />
      <input
        v-model="q"
        type="search"
        required
        class="q"
        :placeholder="messages.search.placeholder"
        :aria-label="messages.search.placeholder"
      />
      <button type="submit" class="primary" :disabled="searching || !q.trim()">
        {{ searching ? messages.search.searching : messages.search.submit }}
      </button>
    </form>
    <ErrorNotice :error="error" />
    <p v-if="results && results.length === 0" class="muted">{{ messages.search.noResults }}</p>
    <div class="results">
      <SearchResultCard
        v-for="result in results ?? []"
        :key="`${result.provider}-${result.externalId}`"
        :result="result"
        :busy="adding"
        @add="add(result)"
      />
    </div>
    <ManualAddForm v-if="manualCollection" :key="manualCollection" :collection="manualCollection" />
  </section>
</template>

<style scoped>
.form {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: var(--s-3);
  margin-bottom: var(--s-6);
}

.types {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-bottom: var(--s-2);
}

.chip {
  cursor: pointer;
}

.form button[type='submit'] {
  grid-column: 1 / -1;
}

.q {
  min-height: 52px;
  font-size: 18px;
}

.year {
  min-height: 52px;
}

.results {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--s-4);
  margin-bottom: var(--s-6);
}

@media (min-width: 760px) {
  .form {
    grid-template-columns: 120px 1fr auto;
  }

  .form button[type='submit'] {
    grid-column: auto;
    min-height: 52px;
    padding: 0 28px;
  }

  .results {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1180px) {
  .results {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
