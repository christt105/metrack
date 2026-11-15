<script setup lang="ts">
import { computed } from 'vue';
import { sizedImageUrl } from '@metrack/domain';
import { messages } from '../i18n/messages';
import { daysBetween } from '../logic/following/dates';
import type { FollowingEvent } from '../logic/following/FollowingEvent';

const props = defineProps<{ event: FollowingEvent; today: string }>();

const entry = computed(() => props.event.entry);
const to = computed(
  () => `/${entry.value.type === 'movie' ? 'movies' : 'series'}/${entry.value.id}`,
);
const image = computed(() => {
  if (entry.value.banner) return sizedImageUrl(entry.value.banner, 'cover');
  return entry.value.cover ? sizedImageUrl(entry.value.cover, 'thumb') : null;
});
const what = computed(() => {
  const next = entry.value.nextEpisode;
  if (entry.value.type === 'movie' || !next) return messages.watchlist.premiere;
  const code = messages.watchlist.episode(next.seasonNumber, next.episodeNumber);
  return next.name ? `${code} · ${next.name}` : code;
});
const days = computed(() => daysBetween(props.today, props.event.date));
</script>

<template>
  <RouterLink :to="to" class="event" :class="{ soon: days >= 0 && days <= 1 }">
    <span class="date" aria-hidden="true">
      <span class="weekday">{{ messages.watchlist.weekday(event.date) }}</span>
      <span class="num">{{ Number(event.date.slice(8)) }}</span>
      <span class="month">{{ messages.watchlist.monthShort(event.date) }}</span>
    </span>
    <span class="thumb" :class="{ wide: Boolean(entry.banner) }">
      <img
        v-if="image"
        :src="image"
        alt=""
        width="780"
        height="439"
        loading="lazy"
        decoding="async"
      />
    </span>
    <span class="body">
      <strong class="title">{{ entry.title }}</strong>
      <span class="what">{{ what }}</span>
      <span class="when">
        <span class="visually-hidden">{{ messages.watchlist.day(event.date) }},</span>
        {{ messages.watchlist.relative(days) }}
      </span>
    </span>
  </RouterLink>
</template>

<style scoped>
.event {
  display: grid;
  grid-template-columns: 56px 160px minmax(0, 1fr);
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-3);
  border: 1px solid var(--outline);
  border-radius: var(--r-md);
  background: var(--surface-low);
  color: var(--on-surface);
  transition:
    transform 120ms var(--ease),
    border-color 120ms var(--ease);
}

.event:hover {
  text-decoration: none;
}

.date {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}

.weekday,
.month {
  color: var(--muted);
  font-size: var(--t-label);
  font-weight: 500;
}

.num {
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.03em;
}

.soon .num {
  color: var(--primary);
}

.thumb {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--r-sm);
  background: var(--surface-high);
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 25%;
  transition: transform var(--m-image-out) var(--ease);
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

.what {
  overflow: hidden;
  color: var(--on-surface);
  font-size: var(--t-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.when {
  color: var(--muted);
  font-size: var(--t-label);
}

.soon .when {
  color: var(--primary);
  font-weight: 500;
}

@media (hover: hover) and (pointer: fine) {
  .event:hover {
    transform: translateY(-2px);
    border-color: var(--outline-strong);
    transition-duration: 180ms;
  }

  .event:hover img {
    transform: scale(1.03);
    transition-duration: var(--m-image);
  }
}

@media (max-width: 599px) {
  .event {
    grid-template-columns: 44px 96px minmax(0, 1fr);
    gap: var(--s-3);
    padding: var(--s-2) var(--s-3) var(--s-2) var(--s-2);
  }

  .num {
    font-size: 22px;
  }

  .title {
    font-size: 15px;
  }
}
</style>
