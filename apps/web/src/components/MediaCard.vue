<script setup lang="ts">
import { computed } from 'vue';
import { messages } from '../i18n/messages';
import type { LibraryCard } from '../logic/buildCards';
import { detailPath } from '../logic/mediaRoutes';
import PendingBadge from './PendingBadge.vue';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{ card: LibraryCard }>();
const to = computed(() => detailPath(props.card.type, props.card.id));
const meta = computed(() => {
  const parts: string[] = [messages.typeLabels[props.card.type]];
  if (props.card.type === 'series' && props.card.seasonCount && props.card.seasonCount > 1) {
    parts.push(messages.list.seasons(props.card.seasonCount));
  }
  if (props.card.subtitle) parts.push(props.card.subtitle);
  return parts.join(' - ');
});
</script>

<template>
  <RouterLink :to="to" class="card">
    <div class="poster">
      <img v-if="card.cover" :src="card.cover" :alt="card.title" loading="lazy" />
      <span v-else class="placeholder">{{ card.title.slice(0, 1) }}</span>
      <span v-if="card.rating !== null" class="rating">{{ card.rating }}</span>
    </div>
    <div class="body">
      <strong class="title">{{ card.title }}</strong>
      <span class="muted meta">{{ meta }}</span>
      <StatusBadge v-if="card.status" :status="card.status" />
      <PendingBadge v-if="card.pendingReview" />
    </div>
  </RouterLink>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--on-surface);
  text-decoration: none;
}

.poster {
  position: relative;
  aspect-ratio: 2 / 3;
  background: var(--surface-high);
  border-radius: var(--radius);
  overflow: hidden;
}

.card:hover .poster {
  outline: 2px solid var(--primary);
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  font-size: 2.5rem;
  color: var(--muted);
}

.rating {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.75);
  font-size: 0.8rem;
}

.body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.9rem;
}

.meta {
  font-size: 0.8rem;
}
</style>
