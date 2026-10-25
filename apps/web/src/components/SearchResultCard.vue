<script setup lang="ts">
import type { SearchResult } from '@metrack/domain';
import { messages } from '../i18n/messages';
import { detailPath } from '../logic/mediaRoutes';

defineProps<{ result: SearchResult; busy: boolean }>();
defineEmits<{ add: [] }>();
</script>

<template>
  <article class="result">
    <img v-if="result.posterUrl" :src="result.posterUrl" :alt="result.title" loading="lazy" />
    <div v-else class="noposter"></div>
    <div class="info">
      <strong>{{ result.title }}</strong>
      <span class="muted">
        {{ result.year ?? '' }}
        <template v-if="result.originalTitle && result.originalTitle !== result.title"
          >- {{ result.originalTitle }}</template
        >
      </span>
      <p v-if="result.overview" class="overview">{{ result.overview }}</p>
      <div class="row">
        <RouterLink
          v-if="result.existingId !== null"
          :to="detailPath(result.type, result.existingId)"
        >
          {{ messages.search.existing }} - {{ messages.common.open }}
        </RouterLink>
        <button v-else type="button" class="primary small" :disabled="busy" @click="$emit('add')">
          {{ messages.search.addTitle }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.result {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--surface-low);
  border: 1px solid var(--outline);
  border-radius: var(--radius);
}

img,
.noposter {
  flex: none;
  width: 72px;
  aspect-ratio: 2 / 3;
  border-radius: 4px;
  object-fit: cover;
  background: var(--surface-high);
}

.info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.overview {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.85rem;
  color: var(--muted);
}
</style>
