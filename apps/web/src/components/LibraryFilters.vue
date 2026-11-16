<script setup lang="ts">
import { MEDIA_SORT_FIELDS, MEDIA_STATUSES, MEDIA_TYPES } from '@metrack/domain';
import { messages } from '../i18n/messages';
import AppIcon from './AppIcon.vue';
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
    <div class="types" role="group" :aria-label="messages.list.type">
      <button
        type="button"
        class="chip"
        :aria-pressed="filters.type === ''"
        @click="update('type', '')"
      >
        {{ messages.list.allTypes }}
      </button>
      <button
        v-for="type in MEDIA_TYPES"
        :key="type"
        type="button"
        class="chip"
        :aria-pressed="filters.type === type"
        @click="update('type', type)"
      >
        {{ messages.typeLabelsPlural[type] }}
      </button>
    </div>
    <div class="fields">
      <input
        class="search"
        type="search"
        :value="filters.q"
        :placeholder="messages.list.searchPlaceholder"
        :aria-label="messages.list.searchPlaceholder"
        @input="update('q', ($event.target as HTMLInputElement).value)"
      />
      <label>
        <span class="label">{{ messages.list.status }}</span>
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
        <span class="label">{{ messages.list.sort }}</span>
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
      <button
        type="button"
        class="order"
        :aria-label="`${messages.list.order}: ${filters.order === 'asc' ? messages.list.ascending : messages.list.descending}`"
        :title="messages.list.toggleOrder"
        @click="update('order', filters.order === 'asc' ? 'desc' : 'asc')"
      >
        <AppIcon :name="filters.order === 'asc' ? 'sortAsc' : 'sortDesc'" />
      </button>
    </div>
  </form>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  margin-bottom: var(--s-5);
}

.types {
  display: flex;
  gap: var(--s-2);
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0 calc(var(--gut) * -1);
  padding: 2px var(--gut);
}

.types::-webkit-scrollbar {
  display: none;
}

.chip {
  cursor: pointer;
}

.order {
  width: 44px;
  padding: 0;
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr 44px;
  gap: var(--s-3);
  align-items: end;
}

.search {
  grid-column: 1 / -1;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.label {
  color: var(--muted);
  font-size: var(--t-label);
  font-weight: 500;
}

@media (min-width: 760px) {
  .types {
    margin: 0;
    padding: 2px 0;
    flex-wrap: wrap;
  }

  .fields {
    grid-template-columns: minmax(240px, 2fr) repeat(2, minmax(160px, 1fr)) 44px;
  }

  .search {
    grid-column: auto;
  }
}
</style>
