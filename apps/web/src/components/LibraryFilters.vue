<script setup lang="ts">
import { MEDIA_SORT_FIELDS, MEDIA_STATUSES, MEDIA_TYPES } from '@metrack/domain';
import { messages } from '../i18n/messages';
import type { LibraryFilterState } from '../logic/LibraryFilterState';
import { naturalOrder } from '../logic/naturalOrder';

const filters = defineModel<LibraryFilterState>({ required: true });

function update<K extends keyof LibraryFilterState>(key: K, value: LibraryFilterState[K]): void {
  filters.value = { ...filters.value, [key]: value };
}

function updateSort(sort: LibraryFilterState['sort']): void {
  filters.value = { ...filters.value, sort, order: naturalOrder(sort) };
}
</script>

<template>
  <form class="filters" role="search" @submit.prevent>
    <input
      class="search"
      type="search"
      :value="filters.q"
      :placeholder="messages.list.searchPlaceholder"
      :aria-label="messages.list.searchPlaceholder"
      @input="update('q', ($event.target as HTMLInputElement).value)"
    />
    <label>
      <span class="muted">{{ messages.list.type }}</span>
      <select
        :value="filters.type"
        @change="
          update('type', ($event.target as HTMLSelectElement).value as LibraryFilterState['type'])
        "
      >
        <option value="">{{ messages.common.any }}</option>
        <option v-for="type in MEDIA_TYPES" :key="type" :value="type">
          {{ messages.typeLabelsPlural[type] }}
        </option>
      </select>
    </label>
    <label>
      <span class="muted">{{ messages.list.status }}</span>
      <select
        :value="filters.status"
        @change="
          update(
            'status',
            ($event.target as HTMLSelectElement).value as LibraryFilterState['status'],
          )
        "
      >
        <option value="">{{ messages.common.any }}</option>
        <option v-for="status in MEDIA_STATUSES" :key="status" :value="status">
          {{ messages.statusLabels[status] }}
        </option>
      </select>
    </label>
    <label>
      <span class="muted">{{ messages.list.sort }}</span>
      <select
        :value="filters.sort"
        @change="
          updateSort(($event.target as HTMLSelectElement).value as LibraryFilterState['sort'])
        "
      >
        <option v-for="field in MEDIA_SORT_FIELDS" :key="field" :value="field">
          {{ messages.sortLabels[field] }}
        </option>
      </select>
    </label>
    <label>
      <span class="muted">{{ messages.list.order }}</span>
      <select
        :value="filters.order"
        @change="
          update('order', ($event.target as HTMLSelectElement).value as LibraryFilterState['order'])
        "
      >
        <option value="asc">{{ messages.list.ascending }}</option>
        <option value="desc">{{ messages.list.descending }}</option>
      </select>
    </label>
  </form>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: var(--gap);
}

.search {
  grid-column: 1 / -1;
}

label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}

@media (min-width: 760px) {
  .filters {
    grid-template-columns: 2fr repeat(4, 1fr);
  }

  .search {
    grid-column: auto;
    align-self: end;
  }
}
</style>
