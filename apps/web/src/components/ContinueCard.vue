<script setup lang="ts">
import { computed } from 'vue';
import { sizedImageUrl } from '@metrack/domain';
import { messages } from '../i18n/messages';
import type { LibraryCard } from '../logic/buildCards';
import { detailPath } from '../logic/mediaRoutes';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{ card: LibraryCard }>();
const to = computed(() => detailPath(props.card.type, props.card.id));
const image = computed(() => {
  if (props.card.banner) return { src: sizedImageUrl(props.card.banner, 'cover'), wide: true };
  if (props.card.cover) return { src: sizedImageUrl(props.card.cover, 'thumb'), wide: false };
  return null;
});
</script>

<template>
  <RouterLink :to="to" class="continue">
    <div class="frame" :class="{ tall: image && !image.wide }">
      <img
        v-if="image"
        :src="image.src"
        alt=""
        width="780"
        height="439"
        loading="eager"
        decoding="async"
      />
      <span v-else class="placeholder" aria-hidden="true">{{ card.title.slice(0, 1) }}</span>
    </div>
    <div class="body">
      <strong class="title">{{ card.title }}</strong>
      <span class="meta">
        {{ messages.typeLabels[card.type] }}
        <StatusBadge v-if="card.status" :status="card.status" />
      </span>
    </div>
  </RouterLink>
</template>

<style scoped>
.continue {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  min-width: 0;
  color: var(--on-surface);
  transition: transform 120ms var(--ease);
}

.continue:hover {
  text-decoration: none;
}

.frame {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--outline);
  border-radius: var(--r-lg);
  background: var(--surface-low);
  transition: border-color 120ms var(--ease);
}

img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--m-image-out) var(--ease);
}

.tall img {
  object-position: center 20%;
}

.placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--muted);
  font-size: 40px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.title {
  overflow: hidden;
  font-size: 17px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  color: var(--muted);
  font-size: var(--t-label);
}

.continue:focus-visible {
  outline: none;
}

.continue:focus-visible .frame {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .continue:hover {
    transform: translateY(-2px);
    transition-duration: 180ms;
  }

  .continue:hover .frame {
    border-color: var(--outline-strong);
  }

  .continue:hover img {
    transform: scale(1.03);
    transition-duration: var(--m-image);
  }
}
</style>
