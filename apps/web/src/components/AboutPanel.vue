<script setup lang="ts">
import { useMessages } from '../composables/useMessages';
import tmdbLogo from '../assets/tmdb-logo.svg';

defineProps<{ version: string | null }>();

const messages = useMessages();
const REPOSITORY = 'https://github.com/christt105/metrack';
</script>

<template>
  <div class="panel" data-test="about">
    <h2>{{ messages.about.title }}</h2>
    <dl>
      <dt class="muted">{{ messages.about.version }}</dt>
      <dd data-test="about-version">{{ version ?? '' }}</dd>
      <dt class="muted">{{ messages.about.source }}</dt>
      <dd>
        <a :href="REPOSITORY" target="_blank" rel="noopener noreferrer">{{
          messages.about.sourceLink
        }}</a>
      </dd>
    </dl>
    <h3>{{ messages.about.dataTitle }}</h3>
    <p class="tmdb">
      <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
        <img :src="tmdbLogo" :alt="messages.about.tmdbLogo" height="10" data-test="tmdb-logo" />
      </a>
    </p>
    <p data-test="tmdb-notice">{{ messages.about.tmdbNotice }}</p>
    <p class="muted" data-test="credits">
      {{ messages.about.credits }}
      <a href="https://www.igdb.com" target="_blank" rel="noopener noreferrer">{{
        messages.about.igdb
      }}</a>,
      <a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">{{
        messages.about.openLibrary
      }}</a>,
      <a href="https://store.steampowered.com" target="_blank" rel="noopener noreferrer">{{
        messages.about.steam
      }}</a>
      &amp;
      <a href="https://www.steamgriddb.com" target="_blank" rel="noopener noreferrer">{{
        messages.about.steamGridDb
      }}</a>.
    </p>
  </div>
</template>

<style scoped>
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0 0 var(--s-4);
}

dd {
  margin: 0;
}

.tmdb {
  margin: 0 0 var(--s-2);
}

.tmdb img {
  display: block;
}
</style>
