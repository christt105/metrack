<script setup lang="ts">
import { computed } from 'vue';
import { sizedImageUrl } from '@metrack/domain';
import { messages } from '../i18n/messages';
import type { LibraryCard } from '../logic/buildCards';
import { detailPath } from '../logic/mediaRoutes';
import PendingBadge from './PendingBadge.vue';
import RatingBadge from './RatingBadge.vue';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{ card: LibraryCard; eager?: boolean }>();
const to = computed(() => detailPath(props.card.type, props.card.id));
const meta = computed(() => {
  const parts: string[] = [messages.typeLabels[props.card.type]];
  if (props.card.type === 'series' && props.card.seasonCount && props.card.seasonCount > 1) {
    parts.push(messages.list.seasons(props.card.seasonCount));
  }
  if (props.card.subtitle) parts.push(props.card.subtitle);
  return parts.join(' · ');
});
</script>

<template>
  <RouterLink :to="to" class="card">
    <div class="poster">
      <img
        v-if="card.cover"
        :src="sizedImageUrl(card.cover, 'thumb')"
        alt=""
        width="342"
        height="513"
        :loading="eager ? 'eager' : 'lazy'"
        decoding="async"
      />
      <span v-else class="placeholder" aria-hidden="true">{{ card.title.slice(0, 1) }}</span>
      <span v-if="card.rating !== null" class="rating">
        <RatingBadge :rating="card.rating" compact :size="14" />
      </span>
    </div>
    <div class="body">
      <strong class="title">{{ card.title }}</strong>
      <span class="meta">{{ meta }}</span>
      <span v-if="card.status || card.pendingReview" class="states">
        <StatusBadge v-if="card.status" :status="card.status" />
        <PendingBadge v-if="card.pendingReview" />
      </span>
    </div>
  </RouterLink>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  color: var(--on-surface);
  text-decoration: none;
  transition: transform 120ms var(--ease);
}

.poster {
  position: relative;
  aspect-ratio: 2 / 3;
  background: var(--surface-low);
  border: 1px solid var(--outline);
  border-radius: var(--r-md);
  overflow: hidden;
  transition: border-color 120ms var(--ease);
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform var(--m-image-out) var(--ease);
}

.placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  font-size: 40px;
  font-weight: 500;
  color: var(--muted);
}

.rating {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--bg);
  color: var(--on-surface);
  font-size: var(--t-label);
  font-weight: 600;
}

.body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
}

.title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.3;
}

.meta {
  color: var(--muted);
  font-size: var(--t-label);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.states {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 2px;
}

.card:hover {
  text-decoration: none;
}

.card:focus-visible {
  outline: none;
}

.card:focus-visible .poster {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .card:hover {
    transform: translateY(-2px);
    transition-duration: 180ms;
  }

  .card:hover .poster {
    border-color: var(--outline-strong);
    transition-duration: 180ms;
  }

  .card:hover img {
    transform: scale(1.03);
    transition-duration: var(--m-image);
  }
}
</style>
