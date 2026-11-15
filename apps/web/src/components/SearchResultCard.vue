<script setup lang="ts">
import { sizedImageUrl } from '@metrack/domain';
import type { SearchResult } from '@metrack/domain';
import { messages } from '../i18n/messages';
import { detailPath } from '../logic/mediaRoutes';

defineProps<{ result: SearchResult; busy: boolean }>();
defineEmits<{ add: [] }>();
</script>

<template>
  <article class="result">
    <img
      v-if="result.posterUrl"
      :src="sizedImageUrl(result.posterUrl, 'thumb')"
      alt=""
      width="342"
      height="513"
      loading="lazy"
      decoding="async"
    />
    <div v-else class="noposter"></div>
    <div class="info">
      <strong>{{ result.title }}</strong>
      <span class="muted">
        {{ result.year ?? '' }}
        <template v-if="result.originalTitle && result.originalTitle !== result.title"
          >· {{ result.originalTitle }}</template
        >
      </span>
      <p v-if="result.overview" class="overview">{{ result.overview }}</p>
      <div class="row">
        <RouterLink
          v-if="result.existingId !== null"
          :to="detailPath(result.type, result.existingId)"
        >
          {{ messages.search.existing }} · {{ messages.common.open }}
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
  gap: var(--s-4);
  padding: var(--s-3);
  background: var(--surface-low);
  border: 1px solid var(--outline);
  border-radius: var(--r-md);
}

img,
.noposter {
  flex: none;
  width: 96px;
  height: 144px;
  border-radius: var(--r-sm);
  object-fit: cover;
  background: var(--surface-high);
}

.info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

strong {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.3;
}

.muted {
  font-size: var(--t-label);
}

.overview {
  margin: 2px 0 var(--s-2);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--t-small);
  line-height: 1.5;
  color: var(--muted);
}

.row {
  margin-top: auto;
}
</style>
