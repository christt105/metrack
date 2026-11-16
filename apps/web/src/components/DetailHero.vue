<script setup lang="ts">
import { computed } from 'vue';
import { sizedImageUrl, type MediaStatus } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { messages } from '../i18n/messages';
import { bannerSources } from '../logic/bannerSources';
import { readDetailFacts } from '../logic/readDetailFacts';
import AppIcon from './AppIcon.vue';
import PendingBadge from './PendingBadge.vue';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{
  detail: AnyDetail;
  title: string;
  eyebrow: string;
  status: MediaStatus | null;
  fallback?: { cover: string | null; banner: string | null } | null;
}>();

const facts = computed(() => readDetailFacts(props.detail));
const cover = computed(() => {
  const own = 'cover' in props.detail ? props.detail.cover : null;
  return own ?? props.fallback?.cover ?? null;
});
const banner = computed(() => {
  const own = 'banner' in props.detail ? props.detail.banner : null;
  return own ?? props.fallback?.banner ?? null;
});
const bannerImage = computed(() => (banner.value ? bannerSources(banner.value) : null));
const pending = computed(() => 'pendingReview' in props.detail && props.detail.pendingReview);
const meta = computed(() =>
  [
    props.eyebrow,
    facts.value.year,
    facts.value.episodeCount ? messages.hero.episodes(facts.value.episodeCount) : null,
  ]
    .filter(Boolean)
    .join(' · '),
);
</script>

<template>
  <header class="hero" :class="{ 'no-banner': !banner }">
    <div v-if="banner" class="banner">
      <img
        :src="bannerImage?.src"
        :srcset="bannerImage?.srcset"
        sizes="(max-width: 599px) 100vw, min(1120px, 100vw)"
        alt=""
        width="1280"
        height="549"
        fetchpriority="high"
      />
    </div>
    <div class="head">
      <div class="poster">
        <img
          v-if="cover"
          :src="sizedImageUrl(cover, 'thumb')"
          :alt="title"
          width="342"
          height="513"
          fetchpriority="high"
        />
        <span v-else class="placeholder" aria-hidden="true">{{ title.slice(0, 1) }}</span>
      </div>
      <div class="words">
        <slot name="before-title" />
        <p class="meta">{{ meta }}</p>
        <h1>{{ title }}</h1>
        <p v-if="facts.originalTitle && facts.originalTitle !== title" class="original">
          {{ facts.originalTitle }}
        </p>
        <div v-if="status || facts.rating !== null || pending" class="state">
          <StatusBadge v-if="status" :status="status" />
          <span v-if="facts.rating !== null" class="rating">
            <AppIcon name="star" :size="16" />
            {{ messages.hero.rating(facts.rating) }}
          </span>
          <PendingBadge v-if="pending" />
        </div>
        <div class="actions">
          <slot name="actions" />
        </div>
      </div>
    </div>
    <div v-if="facts.overview || facts.review || facts.genres.length" class="about">
      <div class="text">
        <p v-if="facts.overview" class="overview">{{ facts.overview }}</p>
        <blockquote v-if="facts.review" class="review">
          <span class="eyebrow">{{ messages.hero.yourReview }}</span>
          {{ facts.review }}
        </blockquote>
      </div>
      <dl class="facts">
        <template v-if="facts.genres.length">
          <dt>{{ messages.hero.genres }}</dt>
          <dd class="tags">
            <span v-for="genre in facts.genres" :key="genre" class="tag">{{ genre }}</span>
          </dd>
        </template>
        <template v-if="facts.people.length">
          <dt>{{ messages.hero.people }}</dt>
          <dd>{{ facts.people.join(', ') }}</dd>
        </template>
        <template v-if="facts.platforms.length">
          <dt>{{ messages.hero.platforms }}</dt>
          <dd>{{ facts.platforms.join(', ') }}</dd>
        </template>
        <template v-if="facts.cast.length">
          <dt>{{ messages.hero.cast }}</dt>
          <dd>{{ facts.cast.join(', ') }}</dd>
        </template>
      </dl>
    </div>
  </header>
</template>

<style scoped>
.hero {
  margin-bottom: var(--s-7);
}

.banner {
  aspect-ratio: 21 / 9;
  max-height: 440px;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--outline);
  border-radius: var(--r-lg);
  background: var(--surface-low);
}

.banner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
  animation: settle 900ms var(--ease-enter) both;
}

.head {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--s-6);
  align-items: end;
  padding: 0 var(--s-6);
  margin-top: -110px;
}

.no-banner .head {
  margin-top: 0;
  padding: 0;
}

.poster {
  position: relative;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border: 1px solid var(--outline-strong);
  border-radius: var(--r-md);
  background: var(--surface-high);
  box-shadow: 0 0 0 6px var(--bg);
}

.no-banner .poster {
  box-shadow: none;
}

.poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--muted);
  font-size: 64px;
}

.words {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s-2);
  min-width: 0;
  padding-bottom: var(--s-2);
  animation: rise 700ms var(--ease-enter) 80ms both;
}

.meta {
  margin: 0;
  color: var(--muted);
  font-size: var(--t-small);
  font-weight: 500;
}

h1 {
  margin: 0;
  font-size: clamp(30px, 2.4vw + 18px, 52px);
  letter-spacing: -0.04em;
  line-height: 1.04;
}

.original {
  margin: 0;
  color: var(--muted);
}

.state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2) var(--s-4);
  margin-top: var(--s-1);
}

.state :deep(.badge) {
  font-size: var(--t-small);
}

.rating {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
}

.rating .icon {
  color: var(--warning);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--s-2) var(--s-3);
  margin-top: var(--s-3);
}

.actions:empty {
  display: none;
}

.about {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(240px, 1fr);
  gap: var(--s-7);
  margin-top: var(--s-7);
  padding: 0 var(--s-6);
}

.no-banner .about {
  padding: 0;
}

.overview {
  max-width: 68ch;
  margin: 0;
  font-size: 17px;
  line-height: 1.7;
}

.review {
  margin: var(--s-5) 0 0;
  padding: var(--s-4) var(--s-5);
  border-left: 2px solid var(--primary);
  background: var(--surface-low);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  font-style: italic;
  line-height: 1.7;
  white-space: pre-line;
}

.review .eyebrow {
  font-style: normal;
}

.facts {
  display: grid;
  gap: var(--s-1);
  margin: 0;
  align-content: start;
}

.facts dt {
  margin-top: var(--s-3);
  color: var(--muted);
  font-size: var(--t-label);
  font-weight: 500;
}

.facts dt:first-child {
  margin-top: 0;
}

.facts dd {
  margin: 0;
  line-height: 1.6;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px !important;
}

.tag {
  padding: 3px 10px;
  border: 1px solid var(--outline);
  border-radius: 999px;
  font-size: var(--t-small);
}

@keyframes settle {
  from {
    opacity: 0;
    transform: scale(1.03);
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}

@media (max-width: 899px) {
  .head {
    grid-template-columns: 132px minmax(0, 1fr);
    gap: var(--s-4);
    padding: 0 var(--s-3);
    margin-top: -64px;
  }

  .about {
    grid-template-columns: 1fr;
    gap: var(--s-5);
    margin-top: var(--s-5);
    padding: 0;
  }
}

@media (max-width: 599px) {
  .banner {
    aspect-ratio: 16 / 9;
    margin: 0 calc(var(--gut) * -1);
    width: auto;
    border-radius: 0;
    border-width: 0 0 1px;
  }

  .head {
    grid-template-columns: 1fr;
    align-items: start;
    padding: 0;
    margin-top: -56px;
  }

  .poster {
    width: 120px;
  }

  .no-banner .head {
    margin-top: 0;
  }

  .actions {
    width: 100%;
  }
}
</style>
